import { getChangeFlat, getSourceInfo } from "@actor/utils/apply-changes.mjs";
import { RollPF } from "@dice/roll.mjs";

/**
 * Change datamodel
 *
 * @property {string} formula
 * @property {"add"|"set"} operator
 * @property {BuffTarget} target
 * @property {string} type - Bonus type
 * @property {string} priority
 * @property {number} value
 * @property {string} flavor
 * @property {boolean} continuous
 * @property {ItemPF|ActorPF} parent
 */
export class ItemChange extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      _id: new fields.StringField({
        blank: false,
        initial: () => foundry.utils.randomID(8),
        required: true,
        readonly: true,
      }),
      formula: new fields.StringField({ blank: true, required: false }),
      operator: new fields.StringField({ blank: false, initial: "add", choices: ["add", "set"] }),
      target: new fields.StringField({ blank: true, required: false }),
      type: new fields.StringField({ blank: true, required: false }),
      priority: new fields.NumberField({ initial: 0, required: false }),
      value: new fields.NumberField({ initial: 0, required: false }),
      flavor: new fields.StringField({ blank: true, initial: undefined, required: false }),
      continuous: new fields.BooleanField({ initial: undefined, required: false }),
    };
  }

  static migrateData(data) {
    // Update terminology
    if (data.subTarget) {
      data.target = data.subTarget;
      delete data.subTarget;
    }
    if (data.modifier) {
      data.type = data.modifier;
      delete data.modifier;
    }
    // Script operator is no longer supported
    // And migrate legacy operators
    if (data.operator === "script") data.operator = "add";
    else if (data.operator === "+") data.operator = "add";
    else if (data.operator === "=") data.operator = "set";
  }

  constructor(data, options = {}) {
    super(data, options);
    this.updateTime = new Date();
  }

  /**
   * @override
   */
  _initialize(options = {}) {
    super._initialize(options);
    // Required to overcome Foundry's _id special case
    Object.defineProperty(this, "_id", {
      value: this._source._id,
      writable: false,
      configurable: true,
    });
    this.prepareData();
  }

  /**
   * Prepare in-memory data.
   *
   * @internal
   */
  prepareData() {
    this.flavor ||= this.parent?.name.replace(/\[|\]/g, "") || this.type;
  }

  /**
   * Creates a change.
   *
   * @param {object[]} data - Data to initialize the change(s) with.
   * @param {object} context - An object containing context information.
   * @param {ItemPF} [context.parent] - The parent entity to create the change within.
   * @returns {ItemChange[]} The resulting changes, or an empty array if nothing was created.
   */
  static async create(data, { parent = null } = {}) {
    if (!Array.isArray(data)) data = [data];

    if (parent instanceof pf1.documents.item.ItemPF) {
      // Prepare data
      data = data.map((dataObj) => new this(dataObj).toObject());

      const oldChangeData = parent.toObject().system.changes ?? [];

      // Catalog existing IDs
      const ids = new Set(oldChangeData.map((c) => c._id));
      // Remove invalid IDs
      ids.delete(undefined);
      ids.delete("");
      // Ensure new data has unique IDs that don't conflict with old
      const newIds = new Set();
      for (const c of data) {
        c._id ||= foundry.utils.randomID(8);
        while (ids.has(c._id)) c._id = foundry.utils.randomID(8);
        ids.add(c._id);
        newIds.add(c._id);
      }

      // Update parent
      const newChangeData = [...oldChangeData, ...data];
      await parent.update({ "system.changes": newChangeData });

      // Return results
      return [...parent.changes.filter((c) => newIds.has(c._id))];
    }

    return [];
  }

  async delete() {
    const item = this.parent;
    if (!item) throw new Error("Can not delete Change not in an item");
    const changes = item.toObject().system.changes ?? [];
    const changeId = this.id;
    changes.findSplice((c) => c._id === changeId);
    return item.update({ "system.changes": changes });
  }

  /** @type {string} - Change ID */
  get id() {
    return this._id;
  }

  /** @type {boolean} */
  get isDeferred() {
    const targetData = pf1.config.buffTargets[this.target];
    if (targetData) return targetData.deferred ?? false;

    // Also any per-skill change is deferred
    return /^skill\./.test(this.target);
  }

  /** @type {boolean} - Does this change refer to a distance? */
  get isDistance() {
    return /speed|sense/i.test(this.target);
  }

  get source() {
    console.warn("ItemChange.source does not exist");
    return null;
  }

  getSourceInfoTargets(actor) {
    switch (this.target) {
      case "aac":
      case "sac":
      case "nac":
        return ["system.attributes.ac.normal.total", "system.attributes.ac.flatFooted.total"];
    }

    // Return default targets
    return getChangeFlat.call(actor, this.target, this.type);
  }

  _preUpdate(data) {
    data = new this.constructor(data).toObject();

    // Make sure sub-target is valid
    /*
    // BUG: This does not work reliably for much anything but skills
    const targetCategory = data.target?.split(".").shift();
    if (targetCategory) {
      const target = data.target || this.target;
      const changeTargets = this.parent.getChangeTargets(targetCategory);
      if (changeTargets[target] == null) {
        console.error(`Invalid change target ${target}, resetting.`);
        data.target = "";
      }
    }
    */

    return data;
  }

  /**
   * @override
   */
  updateSource(data, options) {
    // Shallow copy to avoid altering things for caller
    data = { ...data };
    // Prevent ID alterations
    if (this.id && data._id) delete data._id;

    return super.updateSource(data, options);
  }

  /**
   *
   * @param {object} data - Update data
   * @param {object} options - Additional options
   * @param {object} context - Update context
   * @throws {Error} - If change has no parent to update or the change does not exist on parent.
   * @returns {Promise<Item|null>} - Updated parent, or null if no update was performed (e.g. nothing changed)
   */
  async update(data, options = {}, context = {}) {
    if (!this.parent) throw new Error("ItemChange has no parent to update.");

    this.updateTime = new Date();

    data = this._preUpdate(data);
    // Prevent ID alterations
    if (data._id) delete data._id;

    const changes = this.parent.toObject().system.changes ?? [];

    const idx = changes.findIndex((change) => change._id === this.id);
    if (idx >= 0) {
      const updated = this.updateSource(data);
      // Omit update if nothing would change
      if (foundry.utils.isEmpty(updated)) return null;

      changes[idx] = this.toObject();
      return this.parent.update({ "system.changes": changes }, context);
    } else {
      throw new Error(`Change #${this.id} not found on parent ${this.parent.uuid}`);
    }
  }

  /**
   * Safely apply this change to an actor, catching any errors.
   *
   * @internal
   * @see {@link ItemChange#applyChange}
   * @param {ActorPF} actor - The actor to apply the change's data to.
   * @param {string[]} [targets] - Property paths to target on the actor's data.
   * @param {object} [options] - Optional options to change the behavior of this function.
   * @param {boolean} [options.applySourceInfo=true] - Whether to add the changes to the actor's source information.
   */
  _safeApplyChange(actor, targets = null, { applySourceInfo = true } = {}) {
    try {
      this.applyChange(actor, targets, { applySourceInfo });
    } catch (error) {
      if (this.parent?.isOwner || actor.isOwner) {
        const msgSourceReference = this.parent
          ? `from ${this.parent.name} [${this.parent.uuid}] to ${actor.name}`
          : `to ${actor.name} [${actor.uuid}]]`;
        const errorMessage = `Failed to apply ItemChange ${this.id} ${msgSourceReference}`;
        const errorData = {
          change: this,
          parent: this.parent,
          actor,
          targets,
        };
        Hooks.onError("ItemChange#applyChange", error, {
          msg: errorMessage,
          log: "error",
          data: errorData,
        });
        ui.notifications?.error(error.message, { console: false });
      }
    }
  }

  /**
   * Applies this change to an actor.
   *
   * @param {ActorPF} actor - The actor to apply the change's data to.
   * @param {string[]} [targets] - Property paths to target on the actor's data.
   * @param {object} [options] - Optional options to change the behavior of this function.
   * @param {boolean} [options.applySourceInfo=true] - Whether to add the changes to the actor's source information.
   * @param {object} [options.rollData] - Roll data
   */
  applyChange(actor, targets = null, { applySourceInfo = true, rollData } = {}) {
    // Prepare change targets
    targets ??= this.getTargets(actor);

    rollData ??= this.parent ? this.parent.getRollData({ refresh: true }) : actor.getRollData({ refresh: true });

    const overrides = actor.changeOverrides;
    for (const t of targets) {
      const override = overrides[t];
      const operator = this.operator;

      // HACK: Data prep change application creates overrides; only changes meant for manual comparison lack them,
      // and those do not have to be applied to the actor.
      // This hack enables calling applyChange on Changes that are not meant to be applied, but require a call to
      // determine effective operator and/or value.
      if (!override) continue;

      let value = 0;
      if (this.formula) {
        if (!isNaN(this.formula)) {
          value = parseFloat(this.formula);
        } else if (this.isDeferred && RollPF.parse(this.formula).some((t) => !t.isDeterministic)) {
          value = RollPF.replaceFormulaData(this.formula, rollData, { missing: 0 });
        } else {
          value = RollPF.safeRollSync(
            this.formula,
            rollData,
            [t, this, rollData],
            { suppressError: this.parent && !this.parent.isOwner },
            { maximize: true }
          ).total;
        }
      }

      this.value = value;

      if (!t) continue;

      const prior = override[operator][this.type];

      switch (operator) {
        case "add":
          {
            let base = foundry.utils.getProperty(actor, t);

            // Don't change non-existing ability scores
            if (base == null) {
              if (t.match(/^system\.abilities/)) continue;
              base = 0;
            }

            // Deferred formula
            if (typeof value === "string") break;

            if (typeof base === "number") {
              // Skip positive dodge modifiers if lose dex to AC is in effect
              if (actor.changeFlags.loseDexToAC && value > 0 && this.type === "dodge" && this.isAC) continue;

              if (pf1.config.stackingBonusTypes.includes(this.type)) {
                // Add stacking bonus
                foundry.utils.setProperty(actor, t, base + value);
                override[operator][this.type] = (prior ?? 0) + value;
              } else {
                // Use higher value only
                const diff = !prior ? value : Math.max(0, value - (prior ?? 0));
                foundry.utils.setProperty(actor, t, base + diff);
                override[operator][this.type] = Math.max(prior ?? 0, value);
              }
            }
          }
          break;

        case "set":
          foundry.utils.setProperty(actor, t, value);
          override[operator][this.type] = value;
          break;
      }

      if (applySourceInfo) this.applySourceInfo(actor);

      // Adjust ability modifier
      const modifierChanger = t.match(/^system\.abilities\.([a-zA-Z0-9]+)\.(?:total|penalty|base)$/);
      const abilityTarget = modifierChanger?.[1];
      if (abilityTarget) {
        const ability = actor.system.abilities[abilityTarget];
        ability.mod = pf1.utils.getAbilityModifier(ability.total, {
          damage: ability.damage,
          penalty: ability.penalty,
        });
      }
    }
  }

  /** @type {boolean} - Does this target any kind of AC? */
  get isAC() {
    return ["ac", "aac", "sac", "nac", "tac", "ffac"].includes(this.target);
  }

  /**
   * Applies this change's info to an actor's `sourceInfo`.
   * Info is only added if either the {@link type | modifier type} allows stacking or the {@link value} is higher than the previous value.
   * If the modifier type is not stacking and this change's info is added, existing and now ineffective info entries are removed.
   *
   * @param {ActorPF} actor - The actor to apply the change's data to.
   * @returns {void}
   */
  applySourceInfo(actor) {
    const sourceInfoTargets = this.getSourceInfoTargets(actor);
    const value = this.value;

    // This Change's info entry data
    const infoEntry = {
      value,
      operator: this.operator,
      name: this.parent ? this.parent.name : this.flavor,
      modifier: this.type,
      type: this.parent ? this.parent.type : null,
      change: this,
    };

    switch (this.operator) {
      case "add":
      case "function":
        if (pf1.config.stackingBonusTypes.includes(this.type)) {
          // Always add stacking entries
          const sourceInfoGroup = value >= 0 ? "positive" : "negative";
          for (const si of sourceInfoTargets) {
            getSourceInfo(actor.sourceInfo, si)[sourceInfoGroup].push(infoEntry);
          }
        } else {
          for (const infoTarget of sourceInfoTargets) {
            const sourceInfoGroup = value >= 0 ? "positive" : "negative";
            const sInfo = getSourceInfo(actor.sourceInfo, infoTarget)[sourceInfoGroup];

            // Assume this Change's info entry should be added
            let doAdd = true;

            // The value of the this Change's source info entry for this specific target
            let sumValue = value;

            // Check if there already is an info entry with which this Change should be combined
            // This is the case for `enhancement` and `base` entries otherwise sharing parent and target
            const existingInfoEntry = sInfo.find((infoEntry) => {
              const hasSameParent = infoEntry.change?.parent === this.parent;
              const isEnh =
                (infoEntry.change?.type === "base" && this.type === "enhancement") ||
                (infoEntry.change?.type === "enhancement" && this.type === "base");
              const hasSameTarget = infoEntry.change?.target === this.target;
              return hasSameParent && isEnh && hasSameTarget;
            });
            if (existingInfoEntry) {
              doAdd = false;
              if (existingInfoEntry.change?.type === "base") {
                // This Change enhances an existing base
                existingInfoEntry.value += value;
                continue;
              } else {
                // This Change replaces an existing `enhancement` entry with its own `base` entry, using the sum of both values
                sumValue += existingInfoEntry.value;
                // Check whether the combined entry should exist, or if another entry is already better than it
                const hasHighestValue = !sInfo.some((infoEntry) => {
                  const isSameModifier = infoEntry.modifier === infoEntry.modifier;
                  const target = infoEntry.change?.target;
                  const isSameTarget = target ? target === this.target : true;
                  const hasHigherValue = infoEntry.value > sumValue;
                  return isSameModifier && isSameTarget && hasHigherValue;
                });
                // If the merged entry is the best, replace the existing entry with it
                sInfo.findSplice(
                  (entry) => entry === existingInfoEntry,
                  hasHighestValue ? { ...infoEntry, value: sumValue } : undefined
                );
              }
            }

            // Determine whether there is an entry with a higher value; remove entries with lower values
            if (this.type) {
              sInfo.forEach((oldEntry) => {
                if (!oldEntry.type) return;
                const isSameType = oldEntry.change?.type === oldEntry.type;
                if (isSameType) {
                  if (oldEntry.value < sumValue) {
                    sInfo.splice(sInfo.indexOf(oldEntry), 1);
                  } else {
                    doAdd = false;
                  }
                }
              });
            }

            if (doAdd) sInfo.push({ ...infoEntry });
          }
        }
        break;
      case "set": {
        for (const si of sourceInfoTargets) {
          getSourceInfo(actor.sourceInfo, si).positive.push({ ...infoEntry });
        }
        break;
      }
    }
  }

  /**
   * @see {@link getChangeFlat}
   * @param {ActorPF} actor - Actor instance
   * @returns {Array<string>} - Valid targets for this change on specified actor
   */
  getTargets(actor) {
    return getChangeFlat.call(actor, this.target, this.type, this.value);
  }

  toObject(...options) {
    const data = super.toObject(...options);

    // Cleanup: Following are never meant to be stored
    delete data.value;
    delete data.continuous;

    // Null priority is pointless
    if (data.priority === null) delete data.priority;

    // Clear undefined values
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) delete data[key];
    }

    return data;
  }
}
