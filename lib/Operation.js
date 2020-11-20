'use strict';

const debug = require('@capnajax/debug')('imageProcessor:Operation');
const fs = require('fs').promises;
const path = require('path');
const randomstring = require('randomstring');
const resize = require('./resize');
const _ = require('lodash');

/**
 * @method timestampObj
 * Creates a log entry with a status and a time stamp
 * @param {string} status a one-word status message
 */
function timestampObj(status) {
  let timestamp = Date.now();
  let isoTime = new Date(timestamp).toString();
  return {status, timestamp, isoTime};
}

/**
 *  One operation is an atomic unit, none of the commands in the operation are
 *  successful until all the commands are successful.
 */
class Operation {

  /**
   * @constructor
   * @param {string} filename the name of the image file we're working with
   * @param {string} resultDir where to place the results when complete.
   * @param {object} options extra options. Can include a `transform` to apply
   *    before running any commands, or a list of `commands` to run.
   */
  constructor(filename, resultDir, options) {

    this.image = null;
    this.resultDir = resultDir;

    this.commandPromises = [];
    this.isEnded = false;
    this.completionPromise = null;
    this.isSuccessful = null;
    this.progressFile = path.join(resultDir, 'progress.txt');

    console.log({filename});

    debug('[constructor] setting up ready promise');
    debug({filename, resultDir: this.resultDir});

    this.ready = Promise.all([
      fs.readFile(filename)
        .then(buffer => {
          debug('[constructor] read file');
          debug('[constructor] prereading buffer');
          if (_.has(options, 'transform')) {
            this.imageBuffer = resize.preread(buffer, options.transform);
          } else {
            this.imageBuffer = resize.preread(buffer);
          }
          debug('[constructor] read file promise complete');
        }),
      fs.mkdir(this.resultDir, {recursive: true})
        .then(() => {
          debug('[constructor] created dir');
          // place a file in the dir to mark it as "in progress"
          this.logProgress(timestampObj('STARTING').toString());
          debug('[constructor] creat dir promise complete');
        })
      ]);

    if (_.has(options, 'commands')) {
      for (let cmd of options.commands) {
        this.command(cmd);
      }
    }
  }

  /**
   * @method logProgress
   * Adds an entry to the file's progress log.
   * @param {object} logEntry the log entry
   */
  logProgress(logEntry) {
    debug('[logProgress] called for log entry', logEntry)
    return fs.writeFile(
      this.progressFile,
      JSON.stringify(logEntry),
      {flag: 'a'}
    ).then(() => {
      debug('[logProgress] completed for log entry', logEntry)
    })
  }

  /**
   * @method command
   * Creates a job to run in this operation.
   * @param {object} obj the command to execute in this operation.
   * @param {number} [obj.width] the width to resize to 
   * @param {number} [obj.height] the height to resize to
   * @param {object} [obj.transform] the transform (rotate by degrees or
   *    flip x or y)
   * @param {string} obj.filename the name to give the file after the job is
   *    completed
   */
  command(obj) {
    let commandId = randomstring.generate(6);
    if (this.isEnded) {
      return Promise.reject('command issued after operation ended');
    }
    this.commandPromises.push(
      this.ready
        .then(() => {
            debug('[command] this.ready promise triggered this');
            this.logProgress(_.extend(
              timestampObj('START_COMMAND'),
              {commandId, command: obj}));
          })
        .then(() => {
            // run command
            debug('[command] running command');
            let resizeObj = _.pick(obj, ['width', 'height', 'transform']);
            return resize(this.imageBuffer, resizeObj)
          })
        .then(buffer => {
            debug('[command] logging progress - resize complete');
            this.logProgress(_.extend(
                timestampObj('RESIZE_COMPLETE'),
                {commandId}
              ));
              return buffer;
          })
        .then(buffer => {
            debug('[command] writing file');
            return fs.writeFile(
              path.join(this.resultDir,
              obj.filename), buffer);
          })
        .then(() => {
          debug('[command] logging progress - wrote file');
          this.logProgress(_.extend(
              timestampObj('WROTE_FILE'),
              {commandId, filename: obj.filename}
            ));
          })
        .catch(reason => {
            this.logProgress(_.extend(
              timestampObj('ERROR'),
              {commandId, reason}
            ));
            return Promise.reject(reason);
          })
      );
  }

  /**
   * @method complete
   * Signal that all the commands have been sent, and get a promise for the
   *  result. Calls after the first call to this will return the same promise.
   * @return {Promise} promise that resolves when all the commands are complete
   *  and the files are where they belong.
   */
  complete() {

    debug('[complete] called')

    if (!this.isEnded) {
      debug('[complete] setting up completion promise');
      this.completionPromise = this.ready
        .then(() => {
          debug('[complete] ended. Setting this.isEnded. Awaiting commandPromises.');
          this.isEnded = true;
          return Promise.all(this.commandPromises);
        })
        .then(() => {
          // mark the conversion complete
          debug('[complete] marking conversion complete');
          return this.logProgress(
              timestampObj('OPERATION_COMPLETE').toString()
            );
        })
        .catch(reason => {
          this.logProgress(_.extend(
              timestampObj('FAIL'),
              {reason}
            ));
          return Promise.reject(reason);
        });
    }
    return this.completionPromise;
  }
}

module.exports = Operation;