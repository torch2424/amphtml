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

import {
  OriginExperiments,
  TokenMaster,
} from '../../src/service/origin-experiments-impl';
import {Services} from '../../src/services';
import {bytesToString} from '../../src/utils/bytes';

const argv = require('minimist')(process.argv.slice(2));
const colors = require('ansi-colors');
const log = require('fancy-log');

/**
 * Entry point for 'gulp generate-origin-trial'
 * @return {!Promise}
 */
async function generateOriginTrial() {

  const options = {
    key: null,
    origin: null,
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

  // TODO: Generate a token

  // TODO: Verify the token

  // TODO: Print the token with Instructions
}

module.exports = {
  generateOriginTrial
};

generateOriginTrial.description = 'Generate an origin trial for an origin and experiment';
generateOriginTrial.flags = {
  'key': '  [REQUIRED] Private Key Data to generate the token.',
  'origin': '  [REQUIRED] Full Origin that should match including protocol. E.g https://amp.dev',
  'days-until-expired': '  [REQUIRED] Number of days until the Origin Trial Expires',
};

