/**
 * Copyright 2016 The AMP HTML Authors. All Rights Reserved.
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

import {AmpA4A} from '../../amp-a4a/0.1/amp-a4a';
import {base64UrlDecodeToBytes} from '../../../src/utils/base64';
import {dev} from '../../../src/log';
import {NETWORKS} from './vendors';

/**
 * Header that will contain Cloudflare generated signature
 *
 * @type {string}
 * @private
 */
const AMP_SIGNATURE_HEADER = 'X-AmpAdSignature';

/**
 * This is a minimalistic AmpA4A implementation that primarily gets an Ad
 * through a source URL and extracts the Cloudflare generated signature
 * from a HTTP header.  This is then given to A4A to validate against
 * the cloudflare signing key.  Also see AmpAdNetworkFakeImpl for
 * additional guidance on other implementation details.
 */
export class AmpAdNetworkCloudflareImpl extends AmpA4A {

  /**
   * Validate the tag parameters.  If invalid, ad ad will not be displayed.
   * @override
   */
  isValidElement() {
    const el = this.element;
    return this.isAmpAdElement()
      && el.hasAttribute('src')
      && el.hasAttribute('data-cf-network')
      && NETWORKS[el.getAttribute('data-cf-network')] != null;
  }

  /** @override */
  getSigningServiceNames() {
    // this specifies verification for Cloudflare signing
    return ['cloudflare'];
  }

  /**
   * Handle variable replacements
   *
   * @param {string} str input string to process
   * @param {?Object<string, string>} values to use in the replacements
   * @return {string} result with replaced tokens
   */
  replacements(str, values) {
    // allow injection of width and height as parameters
    str = str.replace(/SLOT_WIDTH/g, values.slotWidth);
    str = str.replace(/SLOT_HEIGHT/g, values.slotHeight);

    return str;
  }

  /** @override */
  getAdUrl() {
    const rect = this.getIntersectionElementLayoutBox();
    const el = this.element;

    const network = el.getAttribute('data-cf-network');
    const a4a = el.getAttribute('data-cf-a4a') !== 'false';
    const base = NETWORKS[network].base;

    // generate URL for ad creative
    let src = el.getAttribute('src');
    if (src[0] != '/') {
      // ensure that we start from the root
      src = '/' + src;
    }
    let url = base + (a4a ? '/_a4a' : '') + src;

    // compute replacement values
    const values = {
      slotWidth: (rect.width || 0).toString(),
      slotHeight: (rect.height || 0).toString(),
    };

    // encode for safety
    url = encodeURI(this.replacements(url, values));

    // include other data attributes as query parameters
    let pre = url.indexOf('?') < 0 ? '?' : '&';
    for (let i = 0; i < el.attributes.length; i++) {
      const attrib = el.attributes[i];
      if (attrib.specified && attrib.name.startsWith('data-')
          && !attrib.name.startsWith('data-cf-')) {
        url += pre + encodeURIComponent(attrib.name.substring(5)) +
          '=' + encodeURIComponent(this.replacements(attrib.value, values));
        pre = '&';
      }
    }

    return url;
  }

  /**
   * Extract creative and signature from a Cloudflare signed response.
   *
   * Note: Invalid A4A content will NOT have a signature, which will automatically
   *   cause the A4A processing to render it within a cross domain frame.
   *
   * @override
   */
  extractCreativeAndSignature(responseText, responseHeaders) {
    let signature = null;
    try {
      if (responseHeaders.has(AMP_SIGNATURE_HEADER)) {
        signature =
          base64UrlDecodeToBytes(dev().assertString(
              responseHeaders.get(AMP_SIGNATURE_HEADER)));
      }
    } finally {
      return Promise.resolve(/** @type {!../../../extensions/amp-a4a/0.1/amp-a4a.AdResponseDef} */
        ({creative: responseText, signature})
      );
    }
  }
}

AMP.registerElement('amp-ad-network-cloudflare-impl',
  AmpAdNetworkCloudflareImpl);
