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

    if (parent instanceof game.pf1.documents.ItemPF) {
      // Prepare data
      data = data.map((dataObj) => mergeObject(this.defaultData, dataObj));
      const newChangeData = deepClone(parent.system.changes || []);
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
    return ["damage", "wdamage", "sdamage"].includes(this.subTarget);
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
   */
  applyChange(actor, targets = null) {
    // Prepare change targets
    if (!targets) {
      targets = getChangeFlat.call(actor, this.subTarget, this.modifier);
      if (!(targets instanceof Array)) targets = [targets];
    }
    const sourceInfoTargets = this.getSourceInfoTargets(actor);
    let addedSourceInfo = false;

    const rollData = this.parent ? this.parent.getRollData({ refresh: true }) : actor.getRollData({ refresh: true });

    const overrides = actor.changeOverrides;
    for (const t of targets) {
      const override = overrides[t];
      if (!overrides || override) {
        let operator = this.operator;
        if (operator === "+") operator = "add";
        if (operator === "=") operator = "set";

        const modifierChanger =
          t != null ? t.match(/^system\.abilities\.([a-zA-Z0-9]+)\.(?:total|penalty|base)$/) : null;
        const isModifierChanger = modifierChanger != null;
        const abilityTarget = modifierChanger?.[1];
        const ability = isModifierChanger ? deepClone(actor.system.abilities[abilityTarget]) : null;

        let value = 0;
        if (this.formula) {
          if (operator === "script") {
            if (!game.settings.get("pf1", "allowScriptChanges")) {
              ui.notifications?.warn(game.i18n.localize("SETTINGS.pf1AllowScriptChangesE"));
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
              const base = getProperty(actor, t);

              // Don't change non-existing values, such as removed ability scores
              if (base == null) continue;

              if (typeof base === "number") {
                if (CONFIG.PF1.stackingBonusModifiers.indexOf(this.modifier) !== -1) {
                  setProperty(actor, t, base + value);
                  override[operator][this.modifier] = (prior ?? 0) + value;

                  if (this.parent && !addedSourceInfo) {
                    for (const si of sourceInfoTargets) {
                      getSourceInfo(actor.sourceInfo, si).positive.push({
                        value: value,
                        name: this.parent.name,
                        type: this.parent.type,
                      });
                    }
                    addedSourceInfo = true;
                  }
                } else {
                  const diff = !prior ? value : Math.max(0, value - (prior ?? 0));
                  setProperty(actor, t, base + diff);
                  override[operator][this.modifier] = Math.max(prior ?? 0, value);

                  if (this.parent) {
                    for (const si of sourceInfoTargets) {
                      const sInfo = getSourceInfo(actor.sourceInfo, si).positive;

                      let doAdd = true;
                      sInfo.forEach((o) => {
                        if (o.modifier === this.modifier) {
                          if (o.value < value) {
                            sInfo.splice(sInfo.indexOf(o), 1);
                          } else {
                            doAdd = false;
                          }
                        }
                      });

                      if (doAdd) {
                        sInfo.push({
                          value: value,
                          name: this.parent.name,
                          type: this.parent.type,
                          modifier: this.modifier,
                        });
                      }
                    }
                  }
                }
              }
            }
            break;

          case "set":
            setProperty(actor, t, value);
            override[operator][this.modifier] = value;

            if (this.parent && !addedSourceInfo) {
              for (const si of sourceInfoTargets) {
                getSourceInfo(actor.sourceInfo, si).positive.push({
                  value: value,
                  operator: "set",
                  name: this.parent.name,
                  type: this.parent.type,
                });
              }
              addedSourceInfo = true;
            }
            break;
        }

        // Adjust ability modifier
        if (isModifierChanger) {
          const prevMod = getAbilityModifier(ability.total, {
            damage: ability.damage,
            penalty: ability.penalty,
          });
          const newAbility = actor.system.abilities[abilityTarget];
          const mod = getAbilityModifier(newAbility.total, {
            damage: newAbility.damage,
            penalty: newAbility.penalty,
          });
          setProperty(
            actor,
            `system.abilities.${abilityTarget}.mod`,
            getProperty(actor, `system.abilities.${abilityTarget}.mod`) - (prevMod - mod)
          );
        }
      }
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
