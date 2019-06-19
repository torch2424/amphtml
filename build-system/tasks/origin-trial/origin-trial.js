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

  log(options.key);

  // TODO: Generate a token
  await page.evaluate(`
    const options = {
      key: ${options.key},
      origin: '${options.origin}',
      experiment: '${options.experiment}',
      days: ${options.days}
    };
    options.key = JSON.parse(options.key);
    ${tokenGeneratorJs}
  `)

  // TODO: Verify the token

  // TODO: Print the token with Instructions
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

