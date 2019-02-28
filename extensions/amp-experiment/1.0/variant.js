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

import {Deferred} from '../../../src/utils/promise';
import {Services} from '../../../src/services';
import {dev, userAssert} from '../../../src/log';
import {hasOwn} from '../../../src/utils/object';
import {isObject} from '../../../src/types';

const ATTR_PREFIX = 'amp-x-';
const nameValidator = /^[\w-]+$/;

export const VARIANT_VERSION = {
  '0.1': '0.1',
  '1.0': '1.0'
};


/**
 * Variants service provides VARIANT variables for the experiment config.
 */
export class Variants {

  /**
   * @param {!../../../src/service/ampdoc-impl.AmpDoc} ampdoc
   */
  constructor(ampdoc) {
    /** @const */
    this.ampdoc = ampdoc;

    /** @private @const {!Deferred<!Object<string, ?string>>} */
    this.variantsDeferred_ = new Deferred();
  }

  /**
   * @param {!Object<string, ?string>|!Promise<!Object<string, ?string>>} variants
   * @package
   * @restricted
   */
  init(variants) {
    setTimeout(() => {
      console.log('resolving...');
      this.variantsDeferred_.resolve(variants);
    }, 1000);
  }

  /**
   * Returns a promise for the experiment variants.
   * @return {!Promise<!Object<string, ?string>>}
   */
  getVariants() {
    return this.variantsDeferred_.promise;
  }
}

/**
 * Allocates the current page view to an experiment variant based on the given
 * experiment config.
 * @param {!../../../src/service/ampdoc-impl.AmpDoc} ampdoc
 * @param {string} experimentName
 * @param {!JsonObject} config
 * @return {!Promise<?string>}
 */
export function allocateVariant(ampdoc, experimentName, config) {
  assertName(experimentName);
  validateConfig(experimentName, config);

  // Variant can be overridden from URL fragment.
  const viewer = Services.viewerForDoc(ampdoc);
  const override = viewer.getParam(ATTR_PREFIX + experimentName);
  if (override && hasOwn(config['variants'], override)) {
    return Promise.resolve(/** @type {?string} */ (override));
  }

  const sticky = config['sticky'] !== false;
  const cidScope = config['cidScope'] || 'amp-experiment';

  let hasConsentPromise = Promise.resolve(true);

  if (sticky && config['consentNotificationId']) {
    const element = ampdoc.getHeadNode();
    hasConsentPromise = Services.userNotificationManagerForDoc(element)
        .then(manager => manager.getNotification(
            config['consentNotificationId']))
        .then(userNotification => {
          userAssert(userNotification,
              `Notification not found: ${config['consentNotificationId']}`);
          return userNotification.isDismissed();
        });
  }

  return hasConsentPromise.then(hasConsent => {
    if (!hasConsent) {
      return null;
    }
    const group = config['group'] || experimentName;
    return getBucketTicket(ampdoc, group, sticky ? cidScope : null)
        .then(ticket => {
          let upperBound = 0;

          // Loop through keys in a specific order since the default object key
          // enumeration is implementation (browser) dependent.
          const variantNames = Object.keys(config['variants']).sort();
          for (let i = 0; i < variantNames.length; i++) {
            upperBound += config['variants'][variantNames[i]];
            if (ticket < upperBound) {
              return variantNames[i];
            }
          }
          return null;
        });
  });
}

/**
 * Function to parse and determine the version
 * of the experiment in the config.
 * Find if we are a 0.1 design (body attributes),
 * or 1.0 design (mutation objects)
 * @param {!JsonObject} config
 * @return string
 */
export function getVariantVersion(variant) {
  if (typeof variant === 'number') {
    return VARIANT_VERSION['0.1']
  } else {
    return VARIANT_VERSION['1.0']
  }
}

/**
 * Validates an experiment config.
 * @param {string} experimentName
 * @param {!JsonObject} config
 * @throws {!Error}
 */
function validateConfig(experimentName, config) {
  const variants = config['variants'];
  userAssert(isObject(variants) && Object.keys(variants).length > 0,
      'Missing experiment variants config.');
  if (config['group']) {
    assertName(config['group']);
  }

  let totalPercentage = 0;
  for (const variantName in variants) {
    if (hasOwn(variants, variantName)) {
      assertName(variantName);

      const variant = variants[variantName];
      assertVariant(
        variant,
        experimentName,
        variantName
      );

      const variantVersion = getVariantVersion(variant);

      let percentage = null;
      if (variantVersion === VARIANT_VERSION['0.1']) {
        percentage = variant;
      } else if(variantVersion === VARIANT_VERSION['1.0']) {
        percentage = variant.weight;
      }

      userAssert(
        percentage && percentage > 0 && percentage < 100,
        'Invalid percentage %s:%s.'
        + ' Has to be greater than 0 and less than 100',
        variantName, percentage);
      totalPercentage += percentage;
    }
  }
  userAssert(totalPercentage./*avoid float precision*/toFixed(6) <= 100,
      'Total percentage is bigger than 100: ' + totalPercentage);
}

/**
 * Returns a float number (bucket ticket) in the range of [0, 100). The number
 * is hashed from the CID of the given scope (opt_cidScope). If the
 * scope is not provided, a random number is used.
 * @param {!../../../src/service/ampdoc-impl.AmpDoc} ampdoc
 * @param {string} group
 * @param {string=} opt_cidScope
 * @return {!Promise<number>} a float number in the range of [0, 100)
 */
function getBucketTicket(ampdoc, group, opt_cidScope) {
  if (!opt_cidScope) {
    return Promise.resolve(ampdoc.win.Math.random() * 100);
  }

  const cidPromise = Services.cidForDoc(ampdoc).then(cidService =>
    cidService.get({
      scope: dev().assertString(opt_cidScope),
      createCookieIfNotPresent: true,
    }, Promise.resolve()));

  return Promise.all([cidPromise, Services.cryptoFor(ampdoc.win)])
      .then(results => results[1].uniform(group + ':' + results[0]))
      .then(hash => hash * 100);
}

/**
 * Asserts if the nae is valid.
 * @param {string} name
 */
function assertName(name) {
  userAssert(nameValidator.test(name),
      'Invalid name: %s. Allowed chars are [a-zA-Z0-9-_].', name);
}

/**
 * Validates the variant schema of a config.
 * @param {!JsonObject} variant
 * @param {!string} experimentName
 * @param {!string} variantName
 * @throws {!Error}
 */
function assertVariant(variant, experimentName, variantName) {

  if (typeof variant === 'number') {
    return;
  }

  // Assert that the variant is an object
  userAssert(
    isObject(variant),
    `${experimentName}.${variantName} must be an object.`);

  // Assert the variant weight
  userAssert(
    variant.weight !== undefined &&
    typeof variant.weight === 'number',
    `${experimentName}.${variantName} must have a weight.`);

  // Assert the variant mutations
  userAssert(
    isArray(variant.mutations),
    `${experimentName}.${variantName} must have a mutations array.`);
}
