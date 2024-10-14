import { AEBase } from "./ae-base.mjs";

/**
 * Buff tracking AE.
 */
export class AEBuff extends AEBase {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      ...super.defineSchema(),
      // Nothing here yet
    };
  }

  /** @type {boolean} - Is this buff tracking AE? */
  get isTracker() {
    // This being false is an error of some kind.
    return this.parent?.parent instanceof Item;
  }
}
