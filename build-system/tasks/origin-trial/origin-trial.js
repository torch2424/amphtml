/**
 * Copyright 2019 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const argv = require('minimist')(process.argv.slice(2));
const babelify = require('babelify');
const browserify = require('browserify');
const colors = require('ansi-colors');
const {execOrDie} = require('../../exec');
const log = require('fancy-log');

// Get our private key
const key = require('./key.js');

// Function to listen for a message from the pupeteer page
function listenForKeyFromConsole(page, key) {
  return new Promise(resolve => {
    const logHandler = (consoleObj) => {
      let text = consoleObj.text();
      if (text.startsWith(key)) {
        page.removeListener('console', logHandler);
        resolve(text.replace(key, ''));
      }
    }
    page.on('console', logHandler);
  });
}

/**
 * Entry point for 'gulp origin-trial'
 * @return {!Promise}
 */
async function originTrial() {

  const options = {
    origin: null,
    experiment: null,
    days: null
  };

  let missingRequiredOptions = false;
  Object.keys(options).forEach(optionKey => {
    if (argv[optionKey]) {
      options[optionKey] = argv[optionKey];
    } else {
      log(`Missing the required "${optionKey}" flag. Please use "gulp help" to see usage`);
      missingRequiredOptions = true;
    }
  });

  if (missingRequiredOptions) {
    return;
  }

  // Create our date timestamp
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + options.days);
  const expirationTimestamp = expirationDate.getTime();

  // Compile our OriginExperiments and TokenMaster
  const bundleTokenGenerator = new Promise((resolve, reject) => {
    browserify({
      entries: 'build-system/tasks/origin-trial/generate-token.js',
      debug: false,
    }).transform(babelify)
      .bundle((err, buf) => {
        if(err) {
          log(err);
          reject(err);
        }

        resolve(buf.toString());
      });
  });
  const tokenGeneratorJs = await bundleTokenGenerator;

  // Launch a pupeteer instance
  if (!argv.noyarn) {
    log('info', 'Running', colors.cyan('yarn'), 'to install Puppeteer...');
    execOrDie('npx yarn --cwd build-system/tasks/origin-trial', {
      'stdio': 'ignore',
    });
  }
  const puppeteer = require('puppeteer');

  log('info', 'Starting', colors.cyan('puppeteer'), '...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  // https://github.com/GoogleChrome/puppeteer/issues/2301
  await page.goto('file:///');
  page.on('console', consoleObj => {
    const text = consoleObj.text();
    if (text.startsWith('INFO:')) {
      log(colors.yellow('Puppeteer Console:'), text.replace('INFO:', ''));
    }
  });

  // Run our Token Generator
  const tokenKey = 'TOKEN:';
  let tokenScript = `
    const options = {
      key: ${JSON.stringify(key)},
      origin: '${options.origin}',
      experiment: '${options.experiment}',
      expirationTimestamp: ${expirationTimestamp}
    };
    const tokenKey = "${tokenKey}";
    ${tokenGeneratorJs}
  `;
  // Mock out devAssert
  tokenScript = tokenScript.replace(
    'exports.devAssert = devAssert;',
    'exports.devAssert = () => {};'
  );
  const tokenResponse = await Promise.all([
    listenForKeyFromConsole(page, tokenKey),
    page.evaluate(tokenScript)
  ]);
  const token = tokenResponse[0];

  // Cleanup
  await browser.close();

  // Print the token with Instructions
  if (token === 'ERROR') {
    log(
      colors.red('There was an error getting the token.') +
      'Please see rhe above error'
    );
    return;
  }

  console.log('Got token', token);
}

module.exports = {
  originTrial
};

originTrial.description = 'Generate an origin trial for an origin and experiment';
originTrial.flags = {
  'origin': '  [REQUIRED] Full Origin that should match including protocol. E.g https://amp.dev',
  'experiment': ' [REQUIRED] Name of the experiment to enable by the origin trial.',
  'days-until-expired': '  [REQUIRED] Number of days until the Origin Trial Expires',
};

