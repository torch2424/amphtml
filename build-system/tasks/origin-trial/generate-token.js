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

// @fileoverview This implements a token generation similar to:
// test/unit/test-origin-experiments
// And verifies the created token.

// NOTE: options, tokenKey passed in from puppeteer.evaluate

import {
  TokenMaster,
  PUBLIC_JWK
} from '../../../src/service/origin-experiments-impl.js';
import {
  Crypto
} from '../../../src/service/crypto-impl.js';

const crypto = new Crypto(window);

const tokenMaster = new TokenMaster(crypto, {
  parse: () => {
    return {
      origin: options.origin
    };
  }
});

const keyData = options.key;
const algo = {
  name: 'RSASSA-PKCS1-v1_5',
  hash: {name: 'SHA-256'},
};

const config = {
  origin: options.origin,
  experiment: options.experiment,
  expiration: options.expirationTimestamp,
};

const keyPromise = crypto.subtle.importKey('jwk',
    keyData,
    algo,
    true,
  ['sign']
);

console.log('INFO:', 'Generating our Crypto Key...');

let token = undefined;
keyPromise.then(key => {
  console.log('INFO:', 'Generating our Token...');
  return tokenMaster.generateToken(0, config, key);
}).then(responseToken => {
  // Save our token
  token = responseToken;

  // Next let's verify the token
  console.log('INFO:', 'Getting our Public Key...');
  return crypto.importPkcsKey(PUBLIC_JWK);
}).then(publicKey => {
  console.log('INFO:', 'Verifying the token against the origin and public key...');
  return tokenMaster.verifyToken(token, options.origin, publicKey);
}).then(() => {
  console.log('INFO:', 'Success! Returning the token...');
  // Since we did not reject, we are verified
  // We verified the token, go ahead and respond with it
  console.log(tokenKey + token);
}).catch(err => {
  console.log('INFO:', err.message);
  console.log(tokenKey + 'ERROR');
});
