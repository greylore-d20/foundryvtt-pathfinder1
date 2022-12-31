import { RollPF } from "./roll.mjs";

/**
 * A specialized Roll class which is used to evaluate damage rolls.
 * Provides additional utility getters for data relevant to damage rolls (e.g. damage type).
 */
export class DamageRoll extends RollPF {
  /**
   * @param {string} formula - The formula to parse.
   * @param {object} data - The data object against which to parse attributes within the formula.
   * @param {object} options - Additional options which customize the created Roll instance.
   */
  constructor(formula, data, options = {}) {
    super(formula, data, options);

    this.options.damageType ??= { values: ["untyped"], custom: "" };
  }

  /**
   * Types of damage rolls with regard to their critical status.
   *
   * @type {{NON_CRITICAL: string, NORMAL: string, CRITICAL: string}}
   */
  static TYPES = {
    NORMAL: "normal",
    CRITICAL: "crit",
    NON_CRITICAL: "nonCrit",
  };

  /**
   * The damage type of this damage roll.
   *
   * @type {{values: string[], custom: string}}
   */
  get damageType() {
    return this.options.damageType;
  }

  /**
   * The type of this damage roll.
   *
   * @see {@link DamageRoll.TYPES}
   * @type {"normal"|"crit"|"nonCrit"}
   */
  get type() {
    return this.options.type;
  }

  /**
   * Whether this damage roll is for a critical damage instance.
   *
   * @type {boolean}
   */
  get isCritical() {
    return this.type === this.constructor.TYPES.CRITICAL;
  }
}
