/**
 *  Crash test -- a sanity check for the code
 */

const debug = require('@capnajax/debug')('imageProcessor:test:crash');
const { DEFAULT_ENCODING } = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const service = require('../lib/httpServer');

const TEST_PORT = 2880;

describe('Crash test', function() {

  let postResponseData = '';

  this.beforeAll(function(done) {
    service.startServer(TEST_PORT);
    service.setOutputDir(path.join(__dirname, 'output'));

    debug('[beforeAll] started');

    let postData = JSON.stringify({
      pathname: path.join(__dirname, 'testImages', 'img1.jpeg'),
      commands: {
        filename: 'result1-1.jpeg',
        width: 480,
        height: 640,
        transform: {}
      },
      commands: {
        filename: 'result1-2.jpeg',
        width: 120,
        height: 160,
        transform: {}
      }
    });

    debug('[beforeAll] postData:');
    debug(postData);
    
    let postOptions = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/job',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    let postReq = http.request(postOptions, function(res) {
      debug('[beforeAll] request made');
      res.on('data', chunk => postResponseData += chunk);
      res.on('end', () => {
        debug('[beforeAll] request end');
        console.log(postResponseData);
        service.stopServer();
        done();
      });
    });
    postReq.write(postData);
    postReq.end();
  
  });

  it ('should convert an image upon request', function(done) {

    // note: request is already made
    console.log(postResponseData);
    done();    

  });
});
