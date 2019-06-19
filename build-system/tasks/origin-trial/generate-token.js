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

// Options passed in from puppeteer.evaluate

import {
  OriginExperiments,
  TokenMaster
} from '../../../src/service/origin-experiments-impl.js';

const tokenMaster = new TokenMaster(crypto, {
  parse: () => {
    return {
      origin: 'test'
    }
  }
});

const keyData = options.key;
const algo = {
  name: 'RSASSA-PKCS1-v1_5',
  hash: {name: 'SHA-256'},
};

const expirationDate = new Date();
expirationDate.setDate(options.days);

const config = {
  origin: options.origin,
  experiment: options.experiment,
  expiration: expirationDate,
};

const keyPromise = crypto.subtle.importKey('jwk',
    keyData,
    algo,
    true,
  ['sign']
);

keyPromise.then(key => {
  console.log('Got Key!');
  return tokenMaster.generateToken(0, config, key);
}).then(token => {
  console.log(token);
}).catch(err => {
  console.log(err.message);
});

