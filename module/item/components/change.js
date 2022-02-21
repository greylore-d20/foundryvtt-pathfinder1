import { getChangeFlat, getSourceInfo } from "../../actor/apply-changes.js";
import { RollPF } from "../../roll.js";
import { getAbilityModifier } from "../../actor/lib.mjs";

export class ItemChange {
  static create(data, parent) {
    const result = new this();

    result.data = mergeObject(this.defaultData, data);
    result.parent = parent;
    result.updateTime = new Date();

    return result;
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

  get source() {
    return this.data.source;
  }
  getSourceInfoTargets(actor) {
    switch (this.subTarget) {
      case "aac":
      case "sac":
      case "nac":
        return ["data.attributes.ac.normal.total", "data.attributes.ac.flatFooted.total"];
    }

    // Return default targets
    let flats = getChangeFlat.call(actor, this.subTarget, this.modifier, null, this, this.parsedData, this.widget);
    if (!(flats instanceof Array)) flats = [flats];
    return flats;
  }

  get widget() {
    return CONFIG.PF1.buffTargets[this.subTarget]?.widget;
  }
  get parsedData() {
    return this.widget != null ? JSON.parse(this.formula) : this.formula;
  }

  prepareData() {}

  preUpdate(data) {
    // Set default value when changing subtarget to something with a widget
    if (data["subTarget"] && data["subTarget"] != this.subTarget) {
      const prevTarget = this.subTarget;
      const newTarget = data["subTarget"];
      const prevWidget = CONFIG.PF1.buffTargets[prevTarget]?.widget;
      const newWidget = CONFIG.PF1.buffTargets[newTarget].widget;
      if (prevWidget !== newWidget) {
        data["formula"] = "0";
        if (newWidget) data["formula"] = JSON.stringify(newWidget.defaultValue);
      }
    }

    return data;
  }

  async update(data, options = {}) {
    this.updateTime = new Date();

    if (this.parent != null) {
      data = this.preUpdate(data);

      const rawChange = this.parent.data.data.changes.find((o) => o._id === this._id);
      const idx = this.parent.data.data.changes.indexOf(rawChange);
      if (idx >= 0) {
        data = Object.entries(data).reduce((cur, o) => {
          cur[`data.changes.${idx}.${o[0]}`] = o[1];
          return cur;
        }, {});
        return this.parent.update(data, options);
      }
    }
  }

  applyChange(actor, targets = null, flags = {}) {
    const widget = CONFIG.PF1.buffTargets[this.subTarget]?.widget;
    let data = {};
    if (widget != null) {
      data = JSON.parse(this.formula);
    }

    // Prepare change targets
    if (!(targets instanceof Array) || targets.filter((o) => o != null).length === 0) {
      targets = getChangeFlat.call(actor, this.subTarget, this.modifier, null, this, data, widget);
      if (!(targets instanceof Array) && targets != null) targets = [targets];
      else if (targets == null) targets = [];
    }
    const sourceInfoTargets = this.getSourceInfoTargets(actor);
    let addedSourceInfo = false;

    const rollData = this.parent ? this.parent.getRollData() : actor.getRollData();

    const overrides = actor.changeOverrides;
    for (const t of targets) {
      // Create target variable, if it doesn't exist yet AND if this is a widget change
      if (widget != null && !hasProperty(this.parent.actor?.data ?? {}, t)) {
        setProperty(this.parent.actor?.data ?? {}, t, 0);
      }

      if (!overrides || overrides[t]) {
        let operator = this.operator;
        if (operator === "+") operator = "add";
        if (operator === "=") operator = "set";

        const modifierChanger = t != null ? t.match(/^data\.abilities\.([a-zA-Z0-9]+)\.(?:total|penalty|base)$/) : null;
        const isModifierChanger = modifierChanger != null;
        const abilityTarget = modifierChanger?.[1];
        const ability = isModifierChanger ? duplicate(rollData.abilities[abilityTarget]) : null;

        let value = 0;
        if (this.formula) {
          if (widget != null) {
            // Get this change's value
            value = widget.getValue(this, data);
            // Do customizable stuff with this change
            widget.applyChange(this, data);
          } else if (operator === "script") {
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
          } else {
            value = RollPF.safeRoll(this.formula, rollData, [t, this, rollData], {
              suppressError: this.parent && !this.parent.testUserPermission(game.user, "OWNER"),
            }).total;
          }
        }

        this.data.value = value;

        if (!t) continue;
        const prior = overrides[t][operator][this.modifier];

        switch (operator) {
          case "add":
            {
              const base = getProperty(actor.data, t);
              if (typeof base === "number") {
                if (CONFIG.PF1.stackingBonusModifiers.indexOf(this.modifier) !== -1) {
                  setProperty(actor.data, t, base + value);
                  overrides[t][operator][this.modifier] = (prior ?? 0) + value;

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
                  setProperty(actor.data, t, base + diff);
                  overrides[t][operator][this.modifier] = Math.max(prior ?? 0, value);

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
            setProperty(actor.data, t, value);
            overrides[t][operator][this.modifier] = value;

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
          const newAbility = rollData.abilities[abilityTarget];
          const mod = getAbilityModifier(newAbility.total, {
            damage: newAbility.damage,
            penalty: newAbility.penalty,
          });
          setProperty(
            actor.data,
            `data.abilities.${abilityTarget}.mod`,
            getProperty(actor.data, `data.abilities.${abilityTarget}.mod`) - (prevMod - mod)
          );
        }
      }
    }
  }

  createFunction(funcDef, funcArgs = []) {
    try {
      const preDef = `const actor = item.actor; const result = { operator: "add", value: 0, };`;
      const postDef = `return result;`;
      const fullDef = `return function(${funcArgs.join(",")}) {${preDef}${funcDef}${postDef}};`;
      return new Function(fullDef)();
    } catch (e) {
      console.warn("Could not create change function with definition ", funcDef);
      return function () {
        return { operator: "add", value: 0 };
      };
    }
  }
}
