import { MigrationCategory } from "./migration-category.mjs";

/**
 * State object for tracking migration progress.
 */
export class MigrationState {
  /** @type {string} Display label */
  label;

  /**
   * @type {Record<number, Function>}
   */
  callbacks = {};

  /**
   * @type {Record<string, MigrationCategory>}
   */
  categories = {};

  completed = false;

  /**
   * @type {boolean} Compendium unlocking state.
   */
  unlock = false;

  constructor(label) {
    if (label) label = game.i18n.localize(label);
    this.label = label;
  }

  /**
   * @param {string} category
   * @param {string} label
   * @param {boolean} isNumber
   * @returns {MigrationCategory}
   */
  createCategory(category, label, isNumber) {
    const mc = new MigrationCategory(category, label, isNumber, this);
    this.categories[category] = mc;
    this.call(mc, { action: "new" });
    return mc;
  }

  /**
   * @param {MigrationCategory|MigrationState} category - Category or the overall state
   * @param {object} info - Category or state specific data
   */
  call(category, info) {
    for (const callback of Object.values(this.callbacks)) {
      try {
        callback(this, category, info);
      } catch (err) {
        console.error(err, callback);
      }
    }
  }

  start() {
    this.completed = false;
    this.call(this, { action: "start" });
  }

  finish() {
    this.completed = true;
    this.call(this, { action: "finish" });
  }
}
