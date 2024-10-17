/**
 * Migation category tracker for @see {MigrationState}
 */
export class MigrationCategory {
  state = null;

  id = null;
  label = null;
  isNumber = false;
  processed = null;
  invalid = 0;
  errors = [];
  current = null;
  total = null;
  ignored = 0;
  completed = false;

  constructor(id, label, isNumber, state) {
    this.state = state;
    this.id = id;
    this.label = game.i18n.localize(label);
    this.isNumber = isNumber;
    if (isNumber) {
      this.total = 0;
      this.processed = 0;
    }
  }

  /**
   * Signal that an entry has started processing.
   *
   * @param {any} entry - Whatever was started processing.
   */
  startEntry(entry) {
    this.current = entry;
    this.state.call(this, { entry, action: "process", actionState: "start", processing: this.processed + 1 });
  }

  /**
   * Signal that an entry has finished processing.
   *
   * @param {any} entry - Whatever was finished processing with.
   */
  finishEntry(entry) {
    this.current = null;
    this.processed += 1;
    this.state.call(this, { entry, action: "process", actionState: "finish", processed: this.processed });
  }

  recordError(entry, error) {
    this.errors.push({ entry, error });
  }

  /**
   * Signal that a specific entry was ignored.
   *
   * @param {any} entry - Whatever was ignored.
   */
  ignoreEntry(entry) {
    this.ignored += 1;
    this.state.call(this, { entry, action: "ignore" });
  }

  /**
   * Add unspecific ignored entries.
   *
   * @param {number} ignored
   */
  addIgnored(ignored) {
    this.ignored += ignored;
    this.state.call(this, { action: "info", ignored, total: this.total, invalid: this.invalid });
  }

  /**
   * Record total number of items in this category.
   *
   * @param {number} total
   */
  setTotal(total) {
    this.total = total;
    this.state.call(this, { action: "info", total, ignored: this.ignored, invalid: this.invalid });
  }

  /**
   * Record total number of invalid items in this category.
   *
   * @param {number} total
   */
  setInvalid(total) {
    this.invalid = total;
    this.state.call(this, { action: "info", total: this.total, ignored: this.ignored, invalid: this.invalid });
  }

  /**
   * Signal the start of processing this category.
   */
  start() {
    this.completed = false;
    this.state.call(this, { action: "start" });
  }

  /**
   * Signal the finishing of processing this category.
   */
  finish() {
    this.completed = true;
    this.state.call(this, { action: "finish" });
  }

  /**
   * Return name of currently processed entry.
   *
   * @type {string|null} - Name of the entry, or null if no entry is being processed.
   */
  get currentName() {
    const current = this.current;
    if (!current) return null;

    if (current instanceof foundry.abstract.Document) return current.name;
    if (current instanceof CompendiumCollection) {
      if (game.i18n.has(current.metadata.label)) return game.i18n.localize(current.metadata.label);
      return current.metadata.label;
    }
    return null;
  }

  getInvalidEntries() {
    let collection;
    switch (this.id) {
      case "actors":
      case "items":
      case "scenes":
        collection = game[this.id];
        break;
      default:
        return [];
    }

    const results = [];
    for (const id of collection.invalidDocumentIds) {
      results.push({ id, entry: collection.getInvalid(id) });
    }

    return results;
  }

  getErrorEntries() {
    return this.errors;
  }
}
