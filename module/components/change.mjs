import { getChangeFlat, getSourceInfo } from "../documents/actor/utils/apply-changes.mjs";
import { RollPF } from "../dice/roll.mjs";

export class ItemChange {
  constructor(data, parent = null) {
    this.data = foundry.utils.mergeObject(this.constructor.defaultData, data);
    this.parent = parent;
    this.updateTime = new Date();
  }

  /**
   * Creates a change.
   *
   * @param {object[]} data - Data to initialize the change(s) with.
   * @param {object} context - An object containing context information.
   * @param {ItemPF} [context.parent] - The parent entity to create the change within.
   * @returns The resulting changes, or an empty array if nothing was created.
   */
  static async create(data, context = {}) {
    const { parent } = context;

    if (parent instanceof pf1.documents.item.ItemPF) {
      // Prepare data
      data = data.map((dataObj) => foundry.utils.mergeObject(this.defaultData, dataObj));

      const newChangeData = foundry.utils.deepClone(parent.toObject().system.changes ?? []);
      newChangeData.push(...data);

      // Ensure unique IDs within the item
      const ids = new Set();
      newChangeData.forEach((change) => ids.add(change._id));
      // Remove invalid IDs
      ids.delete(undefined);
      ids.delete("");

      // Unique ID count does not match number of changes
      if (ids.size != newChangeData.length) {
        while (ids.size < newChangeData.length) ids.add(foundry.utils.randomID(8));

        // Remove already existing unique instances and build list of changes with bad IDs.
        const reAssign = [];
        for (const change of newChangeData) {
          const cid = change._id;
          if (ids.has(cid)) ids.delete(cid);
          else reAssign.push(change);
        }

        // Assign remaining new IDs
        for (const change of reAssign) {
          change._id = ids.first();
          ids.delete(change._id);
        }
      }

      // Update parent
      await parent.update({ "system.changes": newChangeData });

      // Return results
      return [...parent.changes];
    }

    return [];
  }

  static get defaultData() {
    return {
      _id: foundry.utils.randomID(8),
      formula: "",
      operator: "add",
      subTarget: "",
      modifier: "",
      priority: 0,
      value: 0,
      flavor: undefined,
    };
  }

  get id() {
    return this.data._id;
  }
  get _id() {
    return this.data._id;
  }
  get formula() {
    return this.data.formula;
  }
  get operator() {
    return this.data.operator;
  }
  /** @type {BuffTarget} */
  get subTarget() {
    return this.data.subTarget;
  }
  get modifier() {
    return this.data.modifier;
  }
  get priority() {
    return this.data.priority;
  }
  get value() {
    return this.data.value;
  }
  get flavor() {
    return this.data.flavor ?? this.parent?.name.replace(/\[|\]/g, "") ?? this.modifier;
  }
  get continuous() {
    return this.data.continuous;
  }
  get isDeferred() {
    if (["damage", "wdamage", "mwdamage", "twdamage", "rwdamage", "sdamage", "skills"].includes(this.subTarget))
      return true;
    return /^skill\./.test(this.subTarget);
  }

  get source() {
    return this.data.source;
  }
  getSourceInfoTargets(actor) {
    switch (this.subTarget) {
      case "aac":
      case "sac":
      case "nac":
        return ["system.attributes.ac.normal.total", "system.attributes.ac.flatFooted.total"];
    }

    // Return default targets
    return getChangeFlat.call(actor, this.subTarget, this.modifier);
  }

  prepareData() {}

  preUpdate(data) {
    // Ensure priority is a number
    if (typeof data.priority === "string") {
      data.priority = parseInt(data.priority);
    }

    // Make sure sub-target is valid
    if (data.target) {
      const subTarget = data.subTarget || this.subTarget;
      const changeSubTargets = this.parent.getChangeSubTargets(data.target);
      if (changeSubTargets[subTarget] == null) {
        data.subTarget = Object.keys(changeSubTargets)[0];
      }
    }

    return data;
  }

  async update(data, options = {}) {
    if (!this.parent) return;

    this.updateTime = new Date();

    data = this.preUpdate(data);

    const changes = foundry.utils.deepClone(this.parent.toObject().system.changes ?? []);

    const idx = changes.findIndex((change) => change._id === this.id);
    if (idx >= 0) {
      changes[idx] = foundry.utils.mergeObject(changes[idx], data);
      return this.parent.update({ "system.changes": changes });
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
   */
  applyChange(actor, targets = null, { applySourceInfo = true } = {}) {
    // Prepare change targets
    targets ??= this.getTargets(actor);

    // Ensure application of script changes creates a warning
    if (this.operator === "script") {
      ui.notifications?.warn(game.i18n.format("PF1.SETTINGS.AllowScriptChangesF", { parent: this.parent?.name }), {
        console: false,
      });
      console.warn(
        game.i18n.format("PF1.SETTINGS.AllowScriptChangesF", { parent: this.parent?.uuid || this.parent?.name }),
        {
          change: this,
          item: this.parent,
          actor: this.parent?.actor,
        }
      );
    }

    const rollData = this.parent ? this.parent.getRollData({ refresh: true }) : actor.getRollData({ refresh: true });

    const overrides = actor.changeOverrides;
    for (const t of targets) {
      const override = overrides[t];
      let operator = this.operator;

      // HACK: Data prep change application creates overrides; only changes meant for manual comparison lack them,
      // and those do not have to be applied to the actor.
      // This hack enables calling applyChange on Changes that are not meant to be applied, but require a call to
      // determine effective operator and/or value.
      if (!override) continue;

      let value = 0;
      if (this.formula) {
        if (operator === "script") {
          if (!game.settings.get("pf1", "allowScriptChanges")) {
            value = 0;
            operator = "add";
          } else {
            const fn = this.createFunction(this.formula, ["d", "item"]);
            const result = fn(rollData, this.parent);
            value = result.value;
            operator = result.operator;
          }
        } else if (operator === "function") {
          value = this.formula(rollData, this.parent);
          operator = "add";
        } else if (!isNaN(this.formula)) {
          value = parseFloat(this.formula);
        } else if (this.isDeferred && RollPF.parse(this.formula).some((t) => !t.isDeterministic)) {
          value = RollPF.replaceFormulaData(this.formula, rollData, { missing: 0 });
        } else {
          value = RollPF.safeRoll(
            this.formula,
            rollData,
            [t, this, rollData],
            {
              suppressError: this.parent && !this.parent.testUserPermission(game.user, "OWNER"),
            },
            { maximize: true }
          ).total;
        }
      }

      this.data.value = value;

      if (!t) continue;
      if (operator === "script") continue; // HACK: Script Changes without formula are not evaluated

      const prior = override[operator][this.modifier];

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
              if (actor.changeFlags.loseDexToAC && value > 0 && this.modifier === "dodge" && this.isAC) continue;

              if (pf1.config.stackingBonusTypes.includes(this.modifier)) {
                // Add stacking bonus
                foundry.utils.setProperty(actor, t, base + value);
                override[operator][this.modifier] = (prior ?? 0) + value;
              } else {
                // Use higher value only
                const diff = !prior ? value : Math.max(0, value - (prior ?? 0));
                foundry.utils.setProperty(actor, t, base + diff);
                override[operator][this.modifier] = Math.max(prior ?? 0, value);
              }
            }
          }
          break;

        case "set":
          foundry.utils.setProperty(actor, t, value);
          override[operator][this.modifier] = value;
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

  get isAC() {
    return ["ac", "aac", "sac", "nac", "tac", "ffac"].includes(this.subTarget);
  }

  /**
   * Applies this change's info to an actor's `sourceInfo`.
   * Info is only added if either the {@link modifier | modifier type} allows stacking or the {@link value} is higher than the previous value.
   * If the modifier type is not stacking and this change's info is added, existing and now ineffective info entries are removed.
   *
   * @param {ActorPF} actor - The actor to apply the change's data to.
   * returns {void}
   */
  applySourceInfo(actor) {
    const sourceInfoTargets = this.getSourceInfoTargets(actor);
    const value = this.value;

    // This Change's info entry data
    const infoEntryData = {
      value: value,
      name: this.parent ? this.parent.name : this.flavor,
      modifier: this.modifier,
      type: this.parent ? this.parent.type : null,
      change: this,
    };

    switch (this.operator) {
      case "add":
      case "function":
        if (pf1.config.stackingBonusTypes.includes(this.modifier)) {
          // Always add stacking entries
          const sourceInfoGroup = value >= 0 ? "positive" : "negative";
          for (const si of sourceInfoTargets) {
            getSourceInfo(actor.sourceInfo, si)[sourceInfoGroup].push(infoEntryData);
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
                (infoEntry.change?.modifier === "base" && this.modifier === "enhancement") ||
                (infoEntry.change?.modifier === "enhancement" && this.modifier === "base");
              const hasSameTarget = infoEntry.change?.subTarget === this.subTarget;
              return hasSameParent && isEnh && hasSameTarget;
            });
            if (existingInfoEntry) {
              doAdd = false;
              if (existingInfoEntry.change?.modifier === "base") {
                // This Change enhances an existing base
                existingInfoEntry.value += value;
                continue;
              } else {
                // This Change replaces an existing `enhancement` entry with its own `base` entry, using the sum of both values
                sumValue += existingInfoEntry.value;
                // Check whether the combined entry should exist, or if another entry is already better than it
                const hasHighestValue = !sInfo.some((infoEntry) => {
                  const isSameModifier = infoEntry.modifier === infoEntryData.modifier;
                  const subTarget = infoEntry.change?.subTarget;
                  const isSameTarget = subTarget ? subTarget === this.subTarget : true;
                  const hasHigherValue = infoEntry.value > sumValue;
                  return isSameModifier && isSameTarget && hasHigherValue;
                });
                // If the merged entry is the best, replace the existing entry with it
                sInfo.findSplice(
                  (entry) => entry === existingInfoEntry,
                  hasHighestValue ? { ...infoEntryData, value: sumValue } : undefined
                );
              }
            }

            // Determine whether there is an entry with a higher value; remove entries with lower values
            sInfo.forEach((infoEntry) => {
              const isSameModifier =
                infoEntry.change?.modifier === infoEntryData.modifier || infoEntry.modifier === infoEntryData.modifier;
              if (isSameModifier) {
                if (infoEntry.value < sumValue) {
                  sInfo.splice(sInfo.indexOf(infoEntry), 1);
                } else {
                  doAdd = false;
                }
              }
            });

            if (doAdd) {
              sInfo.push({ ...infoEntryData });
            }
          }
        }
        break;
      case "set":
        for (const si of sourceInfoTargets) {
          getSourceInfo(actor.sourceInfo, si).positive.push({
            value: value,
            operator: "set",
            name: this.parent ? this.parent.name : this.flavor,
            modifier: this.modifier,
            type: this.parent ? this.parent.type : null,
            change: this,
          });
        }
        break;
    }
  }

  createFunction(funcDef, funcArgs = []) {
    try {
      const preDef = `const actor = item.actor; const result = { operator: "add", value: 0, };`;
      const postDef = `return result;`;
      const fullDef = `return function(${funcArgs.join(",")}) {${preDef}${funcDef}\n${postDef}};`;
      return new Function(fullDef)();
    } catch (e) {
      console.warn("Could not create change function with definition ", funcDef);
      return function () {
        return { operator: "add", value: 0 };
      };
    }
  }

  /**
   * @see {@link getChangeFlat}
   * @param {ActorPF} actor - Actor instance
   * @returns {Array<string>} - Valid targets for this change on specified actor
   */
  getTargets(actor) {
    return getChangeFlat.call(actor, this.subTarget, this.modifier, this.value);
  }
}
