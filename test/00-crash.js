/**
 *  Crash test -- a sanity check for the code
 */

const debug = require('@capnajax/debug')('imageProcessor:test:crash');
const fs = require('fs').promises;
const http = require('http');
const os = require('os');
const path = require('path');
const service = require('../lib/httpServer');

const TEST_PORT = 2880;

describe('Crash test', function() {

  let postResponseData = '';

  this.afterAll(function(done) {
    service.stopServer();
    done();
  });

  this.beforeAll(async function() {
    service.startServer(TEST_PORT);
    service.setOutputDir(path.join(__dirname, 'output'));

    debug('[beforeAll] started');

    let dtemp, originalImage, testImage;

    return Promise.resolve()
      // copy files to a temporary folder
      .then(async function() {
        dtemp = await fs.mkdtemp(path.join(
          os.tmpdir(), 'imageprocessor-test-00-crash-'));
      })
      .then(async function() {
        originalImage = path.join(__dirname, 'testImages', 'img1.jpeg');
        testImage = path.join(dtemp, 'img1.jpeg');
        await fs.copyFile(originalImage, testImage);  
      })
      .then(async function() { return new Promise((resolve, reject) => {
        let postData = JSON.stringify({
          pathname: testImage,
          commands: [{
            specname: '640p',
            filename: 'result1-1.jpeg',
            width: 480,
            height: 640,
            transform: {}
          },{
            specname: '160p',
            filename: 'result1-2.jpeg',
            width: 120,
            height: 160,
            transform: {}
          }]
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
            debug(postResponseData);
            resolve();
          });
        });
        postReq.write(postData);
        postReq.end();
  
      })});
  });

  it ('should pass a health check', function(done) {
    let getHealthzReq = http.request(
      { hostname: 'localhost',
        port: TEST_PORT,
        path: '/healthz',
        method: 'GET'
      },
      function(res) {
        res.on('data', () => {});
        res.on('close', () => {
          done();
        });
      });
    getHealthzReq.end();
  });

  it ('should convert an image upon request', function(done) {

    // note: request is already made
    debug('[it-should-convert-image]');
    debug(JSON.parse(postResponseData));
    done();    

  });
});
