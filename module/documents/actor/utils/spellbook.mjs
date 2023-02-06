import { calculateRange } from "../../../utils/lib.mjs";

/**
 * Spellbook details.
 */
export class Spellbook {
  /**
   * Book key.
   */
  key;

  /**
   * Owning actor.
   */
  actor;

  /**
   * Raw spellbook data.
   */
  data;

  /**
   * All spells.
   */
  spells = [];

  level = {};

  /**
   * @param bookKey Book key.
   * @param {ActorPF} actor Owning actor.
   */
  constructor(bookKey, actor) {
    this.actor = actor;
    this.data = actor.system.attributes.spells.spellbooks[bookKey];
  }

  /**
   * Add spell to the spellbook and to its appropriate level.
   *
   * @param {ItemSpellPF} spell
   */
  addSpell(spell) {
    this.spells.push(spell);

    // Basic sanity check
    const level = spell.system.level;
    if (Math.clamped(level, 0, 9) !== level) {
      console.error("Spell with impossible spell level:", spell);
      return;
    }

    // Ensure appropriate spell level exists
    this.level[level] ??= new SpellbookLevel(this);

    // Add spell to the spell level also
    this.level[level].spells.push(spell);
  }
}

/**
 * Spellbook leveled details.
 */
export class SpellbookLevel {
  /**
   * Owning book.
   */

  book;
  /**
   * Spells for level.
   */
  spells = [];

  constructor(book) {
    this.book = book;
  }
}

export class SpellbookSlots {
  max;
  value;
  domain;
  domainMax;
  domainUnused = 0;
  used = 0;

  constructor({ value = 0, max = 0, domain = 0 } = {}) {
    this.value = value ?? 0;
    this.max = max ?? 0;

    this.domain = domain ?? 0;
    this.domainMax = this.domain;
    this.domainUnused = this.domainMax;
  }
}

export class SpellRanges {
  close;
  medium;
  long;

  cl;

  constructor(cl) {
    this.cl = cl;
    this.close = calculateRange(null, "close", { cl });
    this.medium = calculateRange(null, "medium", { cl });
    this.long = calculateRange(null, "long", { cl });
  }
}

export class SpellbookMode {
  raw;

  get isHybrid() {
    return this.raw === "hybrid";
  }

  get isPrestige() {
    return this.raw === "prestige";
  }

  get isSpontaneous() {
    return this.raw === "spontaneous";
  }

  get isPrepared() {
    return this.raw === "prepared";
  }

  get usesSpellpoints() {
    return this.raw.spellPoints?.useSystem === true;
  }

  get isSemiSpontaneous() {
    return this.isSpontaneous || this.isHybrid || this.isPrestige || this.usesSpellpoints;
  }

  constructor(book) {
    let mode = book.spellPreparationMode;

    // Shunt invalid mode
    if (!mode) mode = book.spellPreparationMode = "spontaneous";

    this.raw = mode;
  }
}
