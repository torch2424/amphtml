/**
 * Copyright 2018 The AMP HTML Authors. All Rights Reserved.
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

import {Pass} from '../pass';
import {Services} from '../services';
import {
  registerServiceBuilderForDoc,
} from '../service';

/**
 * Service to offer a Mutation Observer to call functions
 * Whenever an element's hidden attribute is modified.
 * Only Works with one document for now.
 * @implements {../service.EmbeddableService}
 */
export class HiddenAttributeMutationObserver {
  /**
   * @param {!./ampdoc-impl.AmpDoc} ampdoc
   */
  constructor(ampdoc) {
    /** @private @const {!./ampdoc-impl.AmpDoc} */
    this.ampdoc_ = ampdoc;
    
    /** @const @private {!Array<Function>} */
    this.callbacks_ = [];
    
    /** @private {?MutationObserver} */
    this.mutationObserver_ = null;

    /** @private {?./service/viewport/viewport-impl.Viewport} */
    this.viewport_ = null;

    /** @private {?Pass} */
    this.mutationPass_ = null;
  }
  
  /**
   * Function to register a callback on the observer.
   * Returns a function to unregister yourself.
   * @param {!Function} callback
   * @return {Function}
   */
  register(callback) {
    if (this.callbacks_.length <= 0) {
      this.initialize_();
    }
    this.callbacks_.push(callback);
    return this.unregister_.bind(this, callback);
  }

  /**
   * Function to create a new mutation observer
   * TODO (@torch2424): Allow this to observe elements,
   * from multiple documents.
   * @private
   */
  initialize_() {
    if (this.ampdoc_.win.MutationObserver && 
      !this.mutationObserver_) {
      this.mutationPass_ = new Pass(this.ampdoc_.win, () => {
        this.handleMutationPassEvent_.bind(this);
      });
      this.mutationObserver_ = new this.ampdoc_.win.MutationObserver(
        this.handleMutationObserverNotification_.bind(this)
      );
      this.mutationObserver_.observe(this.ampdoc_.win.document, {
        attributes: true,
        attributeFilter: ['hidden'],
        subtree: true,
      });
    }
  }
  
  /**
   * Function to unregister a callback on the mutation observer
   */
  unregister_(callback) {
    this.callbacks_.splice(this.callbacks_.indexOf(callback), 1);

    if (this.callbacks_.length <= 1) {
      this.disconnect_();
    }
  }
  
  /**
   * Function to handle whenever we get a mutation observer event
   * @private
   */
  handleMutationObserverNotification_() {
    if (this.mutationPass_.isPending()) {
      return;
    }

    // Wait one animation frame so that other mutations may arrive.
    this.mutationPass_.schedule(16);
    return;
  }
  
  /**
   * Function to handle whenever we get an event from our pass.
   * @private
   */
  handleMutationPassEvent_() {
    this.callbacks_.forEach(callback => {
      callback();
    });
  }

  /**
   * Clean up the mutation observer
   * @private
   */
  disconnect_() {
    if (this.mutationObserver_) {
      this.mutationObserver_.disconnect();
    }
    this.mutationObserver_ = null;
    this.viewport_ = null;
    if (this.mutationPass_) {
      this.mutationPass_.cancel();
    }
    this.mutationPass_ = null;
  }
}

/**
 * @param {!./ampdoc-impl.AmpDoc} ampdoc
 */
export function installHiddenAttributeMutationObserverForDoc(ampdoc) {
  registerServiceBuilderForDoc(
    ampdoc, 
    'hidden-attribute-mutation-observer', 
    HiddenAttributeMutationObserver,
    /* opt_instantiate */ true
  );
}
