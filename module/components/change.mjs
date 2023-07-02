import { getChangeFlat, getSourceInfo } from "../documents/actor/utils/apply-changes.mjs";
import { RollPF } from "../dice/roll.mjs";
import { getAbilityModifier } from "@utils";

export class ItemChange {
  constructor(data, parent) {
    this.data = mergeObject(this.constructor.defaultData, data);
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
  static async create(data, context) {
    const { parent } = context;

    if (parent instanceof pf1.documents.item.ItemPF) {
      // Prepare data
      data = data.map((dataObj) => mergeObject(this.defaultData, dataObj));
      const newChangeData = deepClone(parent.system.changes ?? []);
      newChangeData.push(...data);

      // Update parent
      await parent.update({ "system.changes": newChangeData });

      // Return results
      return data.map((o) => parent.changes.get(o._id));
    }

    return [];
  }

  static get defaultData() {
    return {
      _id: randomID(8),
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

  /**
   * Value is positive modifier, zero inclusive.
   *
   * @type {boolean}
   */
  get isBonus() {
    return this.value >= 0;
  }

  /**
   * Value can't be determined to be positive or negative modifier.
   *
   * @type {boolean}
   */
  get isIndeterminate() {
    return !Number.isFinite(this.value);
  }

  /**
   * Value is negative modifier.
   *
   * @type {boolean}
   */
  get isPenalty() {
    return this.value < 0;
  }

  get flavor() {
    return this.data.flavor ?? this.parent?.name.replace(/\[|\]/g, "") ?? this.modifier;
  }
  get continuous() {
    return this.data.continuous;
  }
  get isDeferred() {
    if (["damage", "wdamage", "sdamage", "skills"].includes(this.subTarget)) return true;
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
    let flats = getChangeFlat.call(actor, this.subTarget, this.modifier);
    if (!(flats instanceof Array)) flats = [flats];
    return flats;
  }

  prepareData() {}

  preUpdate(data) {
    // Make sure sub-target is valid
    {
      if (data["target"]) {
        const subTarget = data["subTarget"] || this.subTarget;
        const changeSubTargets = this.parent.getChangeSubTargets(data["target"]);
        if (changeSubTargets[subTarget] == null) {
          data["subTarget"] = Object.keys(changeSubTargets)[0];
        }
      }
    }

    return data;
  }

  async update(data, options = {}) {
    this.updateTime = new Date();

    if (this.parent != null) {
      data = this.preUpdate(data);

      const rawChange = this.parent.system.changes.find((o) => o._id === this._id);
      const idx = this.parent.system.changes.indexOf(rawChange);
      if (idx >= 0) {
        data = Object.entries(data).reduce((cur, o) => {
          cur[`system.changes.${idx}.${o[0]}`] = o[1];
          return cur;
        }, {});
        return this.parent.update(data, options);
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
    if (!targets) {
      targets = getChangeFlat.call(actor, this.subTarget, this.modifier);
      if (!(targets instanceof Array)) targets = [targets];
    }

    const rollData = this.parent ? this.parent.getRollData({ refresh: true }) : actor.getRollData({ refresh: true });

    const overrides = actor.changeOverrides;
    for (const t of targets) {
      const override = overrides[t];
      let operator = this.operator;
      if (operator === "+") operator = "add";
      if (operator === "=") operator = "set";

      const modifierChanger = t != null ? t.match(/^system\.abilities\.([a-zA-Z0-9]+)\.(?:total|penalty|base)$/) : null;
      const isModifierChanger = modifierChanger != null;
      const abilityTarget = modifierChanger?.[1];
      const ability = isModifierChanger ? deepClone(actor.system.abilities[abilityTarget]) : null;

      let value = 0;
      if (this.formula) {
        if (operator === "script") {
          if (!game.settings.get("pf1", "allowScriptChanges")) {
            ui.notifications?.warn(game.i18n.localize("SETTINGS.pf1AllowScriptChangesE"), { console: false });
            console.warn(game.i18n.localize("SETTINGS.pf1AllowScriptChangesE"), this.parent);
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
        } else if (this.isDeferred) {
          value = RollPF.replaceFormulaData(this.formula, rollData, { missing: 0 });
        } else {
          value = RollPF.safeRoll(this.formula, rollData, [t, this, rollData], {
            suppressError: this.parent && !this.parent.testUserPermission(game.user, "OWNER"),
          }).total;
        }
      }

      this.data.value = value;

      if (!t) continue;
      const prior = override[operator][this.modifier];

      switch (operator) {
        case "add":
          {
            let base = getProperty(actor, t);

            // Don't change non-existing ability scores
            if (base == null) {
              if (t.match(/^system\.abilities/)) continue;
              base = 0;
            }

            // Deferred formula
            if (typeof value === "string") break;

            if (typeof base === "number") {
              if (pf1.config.stackingBonusModifiers.includes(this.modifier)) {
                // Add stacking bonus
                setProperty(actor, t, base + value);
                override[operator][this.modifier] = (prior ?? 0) + value;
              } else {
                // Use higher value only
                const diff = !prior ? value : Math.max(0, value - (prior ?? 0));
                setProperty(actor, t, base + diff);
                override[operator][this.modifier] = Math.max(prior ?? 0, value);
              }
            }
          }
          break;

        case "set":
          setProperty(actor, t, value);
          override[operator][this.modifier] = value;
          break;
      }

      if (applySourceInfo) this.applySourceInfo(actor, value);

      // Adjust ability modifier
      if (isModifierChanger) {
        const newAbility = actor.system.abilities[abilityTarget];
        const mod = getAbilityModifier(newAbility.total, {
          damage: newAbility.damage,
          penalty: newAbility.penalty,
        });

        actor.system.abilities[abilityTarget].mod = mod;
      }
    }
  }

  applySourceInfo(actor) {
    const sourceInfoTargets = this.getSourceInfoTargets(actor);
    let value = this.value;

    switch (this.operator) {
      case "add":
      case "function":
        if (pf1.config.stackingBonusModifiers.includes(this.modifier)) {
          const sourceInfoGroup = value >= 0 ? "positive" : "negative";
          for (const si of sourceInfoTargets) {
            getSourceInfo(actor.sourceInfo, si)[sourceInfoGroup].push({
              value: value,
              name: this.parent ? this.parent.name : this.flavor,
              modifier: this.modifier,
              type: this.parent ? this.parent.type : null,
              change: this,
            });
          }
        } else {
          for (const si of sourceInfoTargets) {
            const sourceInfoGroup = value >= 0 ? "positive" : "negative";
            const sInfo = getSourceInfo(actor.sourceInfo, si)[sourceInfoGroup];

            // Remove entries with lower values
            let doAdd = true;
            sInfo.forEach((infoEntry) => {
              const hasSameParent = infoEntry.change?.parent === this.parent;
              const isEnh =
                (infoEntry.change?.modifier === "base" && this.modifier === "enhancement") ||
                (infoEntry.change?.modifier === "enhancement" && this.modifier === "base");
              const hasSameTarget = infoEntry.change?.subTarget === this.subTarget;
              const alterBase = hasSameParent && isEnh && hasSameTarget;

              if (infoEntry.change?.modifier === this.modifier || alterBase) {
                if (alterBase) {
                  if (infoEntry.change?.modifier === "base") {
                    infoEntry.value += value;
                    doAdd = false;
                  } else {
                    value += infoEntry.value;
                    sInfo.splice(sInfo.indexOf(infoEntry), 1);
                  }
                } else if (infoEntry.value < value) {
                  sInfo.splice(sInfo.indexOf(infoEntry), 1);
                } else {
                  doAdd = false;
                }
              }
            });

            if (doAdd) {
              sInfo.push({
                value: value,
                name: this.parent ? this.parent.name : this.flavor,
                modifier: this.modifier,
                type: this.parent ? this.parent.type : null,
                change: this,
              });
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
}
