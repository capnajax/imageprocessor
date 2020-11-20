'use strict';

const debug = require('@capnajax/debug')('imageProcessor:httpServer');
const fs = require('fs');
const http = require('http');
const path = require('path');
const uuid = require('uuid');
const { URL } = require('url');
const Operation = require('./Operation');
const _ = require('lodash');

const DEFAULT_OUTPUT_BASE_DIR = '/images/ready';

let outputBaseDir;
setOutputDir(DEFAULT_OUTPUT_BASE_DIR);

const server = http.createServer((req, res) => {
  let url = new URL(req.url, `http://${req.headers.host}`);

  switch(url.pathname) {
    case '/healthz':
      debug('[GET healthz] called');
      if (req.method === 'GET') {
        simpleReturn(req, res, '204');
      } else {
        simpleReturn(req, res, '405', 'GET')
      }
      break;

    case '/job':
      debug('[POST job] called');
      if (req.method === 'POST') {
        createJob(req, res);

      } else {
        simpleReturn(req, res, '405', 'POST');
      }
      break;

    default:
      simpleReturn(req, res, '404');
      break;
    }
  }
);

function createJob(req, res) {

  debug('[createJob] called');

  let bodyStr = '';
  let errors = [];
  req.on('data', chunk => bodyStr += chunk);

  req.on('end', () => {
    debug('[createJob] end event');
    debug('[createJob] bodyStr ==', bodyStr);

    let bodyObj;
    try {
      bodyObj = JSON.parse(bodyStr);
    } catch(e) {
      console.log('Failed to parse job');
      simpleReturn(req, res, '400', 'Failed to parse job');
      return;
    }

    // payload must have a pathname parameter
    if (!_.has(bodyObj, 'pathname')) {
      console.log('Missing pathname');
      simpleReturn(req, res, '400', 'missing pathname in request');
    }

    // every job must have a filename to output
    if (_.has(bodyObj, 'commands')) {
      if (!_.isArray(bodyObj.commands)) {
        bodyObj.commands = [bodyObj.commands];
      }
      for (let cmd of bodyObj.commands) {
        if (_.has(cmd, 'filename')) {
          if (cmd.filename.match('/')) {
            errors += `illegal characters in filename ${cmd.filename}`;
          }
        } else {
          // empty job
          simpleReturn(req, res, '204');
        }
      }
    } else {
      // there must be a job in the process
      errors += 'empty job. no commands';
    }

    if (errors.length > 0) {
      simpleReturn(req, res, '400', JSON.stringify(errors));
    } else {

      let uuidString = uuid.v4();

      // decide the directory
      let outputDir = path.join(
        outputBaseDir,
        uuidString.substring(0, 3),
        uuidString.substring(3, 6),
        uuidString);

      // create the operation
      debug('[createJob] bodyObj:')
      debug(bodyObj);

      let op = new Operation(bodyObj.pathname, outputDir);

      // add jobs to the operation
      for (let cmd of bodyObj.commands) {
        op.command(cmd);
      }

      debug('[createJob] created operation and added jobs');

      op.complete()
      .then(() => {
        debug('[createJob] operation complete');
        res.statusCode = '200';
        res.end(JSON.stringify({
          uuid: uuidString,
          outputDir,
          log: op.progressFile
        }));
      });
    }
  });
}


function setOutputDir(newOutputDir) {
  outputBaseDir = newOutputDir;
}

function simpleReturn(req, res, status, message) {

  switch(status) {
    // create a case for every status that requires additional information
    // and use the `message` parameter to get that information
    case '405': 
      res.statusCode = '405';
      res.headers.Allow = message;
      res.end();
      break;

    default:
      // this is applicable to any status that doesn't require additional
      // information. For example a 404 is just a 404, but a 302 requires
      // a new Location header.
      res.statusCode = status || '204';
      res.end(message);
      break;
  }
}

/**
 *  @method startServer
 *  Start the server
 *  @param {Number} [port] port to bind. Default: 80 
 */
function startServer(port = 80) {
  debug('[startServer] starting server on port', port);
  server.listen(port);
};

/**
 *  @method stopServer
 *  Stop the server
 *  @param {Number} [port] port to bind. Default: 80 
 */
function stopServer() {
  debug('[stopServer] stopping server');
  server.close(port);
};

module.exports = {
  setOutputDir,
  startServer,
  stopServer
};
