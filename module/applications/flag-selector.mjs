import { ActorTraitSelector } from "@app/trait-selector.mjs";

/**
 * A trait selector variant that reads and stores information into an object with boolean values.
 *
 * @augments {DocumentSheetV2&HandlebarsApplicationMixin}
 * @property {string} _searchFilter           Current search filter
 * @property {string} _collator               Collator for sorting
 * @property {object} attributes              The currently stored values for this trait selector
 * @property {string[]} attributes.value      Elements from the provided set of choices that have been checked
 */
export class FlagSelector extends ActorTraitSelector {
  static DEFAULT_OPTIONS = {
    form: {
      handler: FlagSelector._updateDocument,
    },
  };

  constructor(options) {
    options.hasCustom = false;
    super(options);

    const valueObject = foundry.utils.getProperty(options.document.toObject(), this.attribute) ?? {};

    this.attributes = {
      value: [],
      custom: [],
    };

    Object.entries(valueObject).forEach(([k, v]) => {
      if (v) this.attributes.value.push(k);
    });
  }

  /* -------------------------------------------- */

  /**
   * Update the Actor object with new trait data processed from the form
   *
   * @this {FlagSelector&DocumentSheetV2}
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @returns {Promise<void>}
   * @private
   */
  static async _updateDocument(event, form, formData) {
    // Unregister this app from doc to avoid re-renders
    delete this.document.apps[this.appId];
    const { value } = this.attributes;

    const options = Object.keys(this.options.choices);
    const newValue = {};
    options.forEach((o) => {
      newValue[o] = value.includes(o);
    });

    const updateData = {
      [this.attribute]: newValue,
    };

    this.document.update(updateData);
    this.close({ force: true });
  }
}
