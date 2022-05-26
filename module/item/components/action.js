import { calculateRange, convertDistance } from "../../lib.js";
import { getHighestChanges } from "../../actor/apply-changes.js";

export class ItemAction {
  constructor() {
    this.apps = {};
  }

  static create(data, parent) {
    const result = new this();

    result.data = mergeObject(this.defaultData, data);
    result.parent = parent;

    return result;
  }

  get item() {
    return this.parent;
  }
  get actor() {
    return this.parent.parentActor;
  }

  get _id() {
    return this.data._id;
  }
  get id() {
    return this._id;
  }
  get img() {
    return this.data.img;
  }
  get name() {
    return this.data.name;
  }

  get hasAction() {
    return !!this.data.actionType;
  }
  get hasAttack() {
    return ["mwak", "rwak", "msak", "rsak", "mcman", "rcman"].includes(this.data.actionType);
  }

  get hasMultiAttack() {
    return (
      this.hasAttack &&
      ((this.data.attackParts != null && this.data.attackParts.length > 0) ||
        this.data.formulaicAttacks?.count?.value > 0)
    );
  }

  get autoDeductCharges() {
    return this.isCharged && this.data.uses.autoDeductCharges === true;
  }

  get chargeCost() {
    const formula = this.data.uses.autoDeductChargesCost;
    if (!(typeof formula === "string" && formula.length > 0)) return 1;
    const cost = RollPF.safeRoll(formula, this.getRollData()).total;
    return this.item.isSingleUse ? Math.max(-1, Math.min(1, cost)) : cost;
  }

  // Returns range (in system configured units)
  get range() {
    const range = this.data.range.value;
    const rangeType = this.data.range.units;

    if (rangeType == null) return null;

    return calculateRange(range, rangeType, this.getRollData());
  }

  get minRange() {
    const rng = this.data.data.range;
    if (rng.minUnits !== "" && rng.minValue !== null) {
      const rollData = this.getRollData();
      const formula = { melee: "@range.melee", reach: "@range.reach" }[rng.minUnits] ?? (rng.minValue || "0");
      return convertDistance(RollPF.safeRoll(formula, rollData).total)[0];
    }
    return 0;
  }

  get maxRange() {
    return this.data.data.range.maxIncrements * this.range;
  }

  get hasTemplate() {
    const v = this.data.measureTemplate.type;
    const s = this.data.measureTemplate.size;
    return (
      typeof v === "string" && v !== "" && ((typeof s === "string" && s.length > 0) || (typeof s === "number" && s > 0))
    );
  }

  /**
   * Does the action implement a damage roll as part of its usage
   *
   * @type {boolean}
   */
  get hasDamage() {
    return !!this.data.damage.parts?.length;
  }

  /**
   * Does the item have range defined.
   *
   * @type {boolean}
   */
  get hasRange() {
    return this.data.range?.units != null;
  }

  /* -------------------------------------------- */

  /**
   * Does the item provide an amount of healing instead of conventional damage?
   *
   * @returns {boolean}
   */
  get isHealing() {
    return this.data.actionType === "heal" && this.data.damage.parts.length;
  }

  get hasEffect() {
    return this.hasDamage || (this.data.effectNotes != null && this.data.effectNotes.length > 0);
  }

  /**
   * Does the Item implement a saving throw as part of its usage
   *
   * @type {boolean}
   */
  get hasSave() {
    return typeof this.data.save?.type === "string" && this.data.save?.type.length > 0;
  }

  /**
   * @param {object} [rollData] - Data to pass to the roll. If none is given, get new roll data.
   * @returns {number} The Difficulty Class for this action.
   */
  getDC(rollData = null) {
    // No actor? No DC!
    if (!this.actor) return 0;

    rollData = rollData ?? this.getRollData();
    const data = rollData.item;

    let result = 10;

    // Get conditional save DC bonus
    const dcBonus = rollData["dcBonus"] ?? 0;

    const dcFormula = this.data.save.dc.toString() || "0";
    try {
      result = RollPF.safeRoll(dcFormula, rollData).total + dcBonus;
    } catch (e) {
      console.error(e, dcFormula);
    }
    return result;
  }

  get hasSound() {
    return !!this.data.soundEffect;
  }

  getRollData() {
    const result = this.item.getRollData();
    result.action = duplicate(this.data);
    return result;
  }

  static get defaultData() {
    return {
      _id: randomID(16),
      name: game.i18n.localize("PF1.Action"),
      img: "systems/pf1/icons/skills/gray_04.jpg",
      activation: {
        cost: 1,
        type: "",
      },
      unchainedAction: {
        activation: {
          cost: 1,
          type: "",
        },
      },
      duration: {
        value: null,
        units: "",
      },
      target: {
        value: "",
      },
      range: {
        value: null,
        units: "",
        maxIncrements: 1,
        minValue: null,
        minUnits: "",
      },
      uses: {
        autoDeductCharges: true,
        autoDeductChargesCost: "1",
      },
      measureTemplate: {
        type: "",
        size: "",
        overrideColor: false,
        customColor: "",
        overrideTexture: false,
        customTexture: "",
      },
      attackName: "",
      actionType: null,
      attackBonus: "",
      critConfirmBonus: "",
      damage: {
        parts: [],
        critParts: [],
        nonCritParts: [],
      },
      attackParts: [],
      formulaicAttacks: {
        count: { formula: "" },
        bonus: { formula: "" },
        label: null,
      },
      formula: "",
      ability: {
        attack: null,
        damage: null,
        damageMult: 1,
        critRange: 20,
        critMult: 2,
      },
      save: {
        dc: 0,
        type: "",
        description: "",
      },
      effectNotes: [],
      attackNotes: [],
      soundEffect: "",
      powerAttack: {
        multiplier: "",
        damageBonus: 2,
        critMultiplier: 1,
      },
      naturalAttack: {
        secondary: {
          attackBonus: "-5",
          damageMult: 0.5,
        },
      },
      attackType: "weapon",
      nonlethal: false,
      usesAmmo: false,
    };
  }

  prepareData() {
    const data = this.data;
    const C = CONFIG.PF1;

    this.labels = {};

    // Activation method
    if (Object.prototype.hasOwnProperty.call(data, "activation")) {
      const activationTypes = game.settings.get("pf1", "unchainedActionEconomy")
        ? CONFIG.PF1.abilityActivationTypes_unchained
        : CONFIG.PF1.abilityActivationTypes;
      const activationTypesPlural = game.settings.get("pf1", "unchainedActionEconomy")
        ? CONFIG.PF1.abilityActivationTypesPlurals_unchained
        : CONFIG.PF1.abilityActivationTypesPlurals;

      // Ability Activation Label
      const act = game.settings.get("pf1", "unchainedActionEconomy")
        ? data.unchainedAction.activation || {}
        : data.activation || {};
      if (act && act.cost > 1 && activationTypesPlural[act.type] != null) {
        this.labels.activation = [act.cost.toString(), activationTypesPlural[act.type]].filterJoin(" ");
      } else if (act) {
        this.labels.activation = [
          ["minute", "hour", "action"].includes(act.type) && act.cost ? act.cost.toString() : "",
          activationTypes[act.type],
        ].filterJoin(" ");
      }

      // Target Label
      const tgt = data.target || {};
      if (["none", "touch", "personal"].includes(tgt.units)) tgt.value = null;
      if (["none", "personal"].includes(tgt.type)) {
        tgt.value = null;
        tgt.units = null;
      }
      this.labels.target = [tgt.value, C.distanceUnits[tgt.units], C.targetTypes[tgt.type]].filterJoin(" ");
      if (this.labels.target) this.labels.target = `${game.i18n.localize("PF1.Target")}: ${this.labels.target}`;

      // Range Label
      const rng = duplicate(data.range || {});
      if (!["ft", "mi", "spec"].includes(rng.units)) {
        rng.value = null;
        rng.long = null;
      } else if (typeof rng.value === "string" && rng.value.length) {
        try {
          rng.value = RollPF.safeTotal(rng.value, this.parent.getRollData()).toString();
        } catch (err) {
          console.error(err);
        }
      }
      this.labels.range = [rng.value, rng.long ? `/ ${rng.long}` : null, C.distanceUnits[rng.units]].filterJoin(" ");
      if (this.labels.range.length > 0)
        this.labels.range = [`${game.i18n.localize("PF1.Range")}:`, this.labels.range].join(" ");

      // Duration Label
      const dur = duplicate(data.duration || {});
      if (["inst", "perm", "spec", "seeText"].includes(dur.units)) dur.value = game.i18n.localize("PF1.Duration") + ":";
      else if (typeof dur.value === "string" && this.parentActor) {
        dur.value = RollPF.safeRoll(dur.value || "0", this.parent.getRollData(), [
          this.name,
          "Duration",
        ]).total.toString();
      }
      this.labels.duration = [dur.value, C.timePeriods[dur.units]].filterJoin(" ");
    }

    // Actions
    if (Object.prototype.hasOwnProperty.call(data, "actionType")) {
      // Damage
      const dam = data.damage || {};
      if (dam.parts && dam.parts instanceof Array) {
        this.labels.damage = dam.parts
          .map((d) => d[0])
          .join(" + ")
          .replace(/\+ -/g, "- ");
        this.labels.damageTypes = dam.parts.map((d) => d[1]).join(", ");
      }

      // Add attack parts
      if (!data.attack) data.attack = { parts: [] };
    }
  }

  async delete() {
    const actions = duplicate(this.item.data.data.actions);
    const idx = this.item.data.data.actions.indexOf(this.data);
    actions.splice(idx, 1);

    // Close applications
    const promises = [];
    for (const app of Object.values(this.apps)) {
      promises.push(app.close());
    }
    await Promise.all(promises);

    // Delete action
    return this.item.update({ "data.actions": actions });
  }

  async update(updateData, options = {}) {
    const idx = this.item.data.data.actions.indexOf(this.data);
    const prevData = duplicate(this.data);
    const newUpdateData = flattenObject(mergeObject(prevData, updateData));

    // Make sure stuff remains an array
    {
      const keepArray = [
        { key: "attackParts" },
        { key: "damage.parts" },
        { key: "damage.critParts" },
        { key: "damage.nonCritParts" },
        { key: "attackNotes" },
        { key: "effectNotes" },
      ];

      for (const kArr of keepArray) {
        if (Object.keys(newUpdateData).filter((e) => e.startsWith(`${kArr.key}.`)).length > 0) {
          const subData = Object.entries(newUpdateData).filter((e) => e[0].startsWith(`${kArr.key}.`));
          const arr = duplicate(getProperty(this.data, kArr.key) || []);
          const keySeparatorCount = (kArr.key.match(/\./g) || []).length;
          subData.forEach((entry) => {
            const subKey = entry[0].split(".").slice(keySeparatorCount + 1);
            const i = subKey[0];
            const subKey2 = subKey.slice(1).join(".");
            if (!arr[i]) arr[i] = {};

            // Single entry array
            if (!subKey2) {
              arr[i] = entry[1];
            }
            // Remove property
            else if (subKey[subKey.length - 1].startsWith("-=")) {
              const obj = flattenObject(arr[i]);
              subKey[subKey.length - 1] = subKey[subKey.length - 1].slice(2);
              const deleteKeys = Object.keys(obj).filter((o) => o.startsWith(subKey.slice(1).join(".")));
              for (const k of deleteKeys) {
                if (Object.prototype.hasOwnProperty.call(obj, k)) {
                  delete obj[k];
                }
              }
              arr[i] = expandObject(obj);
            }
            // Add or change property
            else {
              arr[i] = mergeObject(arr[i], expandObject({ [subKey2]: entry[1] }));
            }

            delete newUpdateData[entry[0]];
          });

          newUpdateData[kArr.key] = arr;
        }
      }
    }

    await this.item.update({ [`data.actions.${idx}`]: expandObject(newUpdateData) });
  }

  // -----------------------------------------------------------------------

  /**
   * Place a damage roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.damageRoll logic for the core implementation
   *
   * @param root0
   * @param root0.data
   * @param root0.critical
   * @param root0.extraParts
   * @param root0.conditionalParts
   * @param root0.primaryAttack
   */
  async rollDamage({
    data = null,
    critical = false,
    extraParts = [],
    conditionalParts = {},
    primaryAttack = true,
  } = {}) {
    const rollData = duplicate(data ?? this.getRollData());

    if (!this.hasDamage) {
      throw new Error("You may not make a Damage Roll with this Action.");
    }

    // Determine critical multiplier
    rollData.critMult = 1;
    if (critical) rollData.critMult = this.data.ability.critMult;
    // Determine ability multiplier
    if (rollData.ablMult == null) rollData.ablMult = this.data.ability.damageMult;
    if (this.item.data.data.attackType === "natural" && primaryAttack === false && rollData.ablMult > 0)
      rollData.ablMult = 0.5;

    // Define Roll parts
    let parts = this.data.damage.parts.map((p) => {
      return { base: p[0], extra: [], damageType: p[1], type: "normal" };
    });
    // Add conditionals damage
    conditionalParts["damage.normal"]?.forEach((p) => {
      const [base, damageType, isExtra] = p;
      isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type: "normal" });
    });
    // Add critical damage parts
    if (critical === true) {
      if (getProperty(this.data, "data.damage.critParts") != null) {
        parts = parts.concat(
          this.data.damage.critParts.map((p) => {
            return { base: p[0], extra: [], damageType: p[1], type: "crit" };
          })
        );
      }
      // Add conditional critical damage parts
      conditionalParts["damage.crit"]?.forEach((p) => {
        const [base, damageType, isExtra] = p;
        isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type: "crit" });
      });
    }
    // Add non-critical damage parts
    if (critical === false) {
      if (getProperty(this.data, "data.damage.nonCritParts") != null) {
        parts = parts.concat(
          this.data.damage.nonCritParts.map((p) => {
            return { base: p[0], extra: [], damageType: p[1], type: "nonCrit" };
          })
        );
      }
      // Add conditional non-critical damage parts
      conditionalParts["damage.nonCrit"]?.forEach((p) => {
        const [base, damageType, isExtra] = p;
        isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type: "nonCrit" });
      });
    }

    if (!this.isHealing) {
      const isSpell = ["msak", "rsak", "spellsave"].includes(this.data.actionType);
      const isWeapon = ["mwak", "rwak"].includes(this.data.actionType);
      const changes = this.item.getContextChanges(isSpell ? "sdamage" : isWeapon ? "wdamage" : "damage");
      // Get damage bonus
      getHighestChanges(
        changes.filter((c) => {
          c.applyChange(this.actor);
          return !["set", "="].includes(c.operator);
        }),
        { ignoreTarget: true }
      ).forEach((c) => {
        let value = c.isDeferred ? c.formula : c.value;
        // Put in parenthesis if there's chance it is more complex
        if (/[\s+-?:]/.test(value)) value = `(${value})`;
        parts[0].extra.push(`${value}[${c.flavor}]`);
      });

      // Add broken penalty
      if (this.item.data.data.broken) {
        const label = game.i18n.localize("PF1.Broken");
        parts[0].extra.push(`-2[${label}]`);
      }
    }

    // Determine ability score modifier
    const abl = this.data.ability.damage;
    if (typeof abl === "string" && abl !== "") {
      // Determine ability score bonus
      rollData.ablDamage = Math.floor(rollData.abilities[abl].mod * rollData.ablMult);
      if (rollData.abilities[abl].mod < 0) rollData.ablDamage = rollData.abilities[abl].mod;

      // Determine ability score label
      const ablLabel = CONFIG.PF1.abilities[abl];

      // Add ability score
      parts[0].extra.push(`@ablDamage[${ablLabel}]`);
    }

    // Create roll
    const rolls = [];
    for (let a = 0; a < parts.length; a++) {
      const part = parts[a];
      let rollParts = [];
      if (a === 0) rollParts = [...part.extra, ...extraParts];
      const formula = [part.base, ...rollParts].join(" + ");
      // Skip empty formulas instead of erroring on them
      if (formula.length == 0) continue;
      try {
        const roll = {
          roll: await RollPF.create(formula, rollData).evaluate({ async: true }),
          damageType: part.damageType,
          type: part.type,
        };
        // Remove all negative damage results on critical damage
        if (critical) {
          const parts = [];
          roll.roll.terms.forEach((t, i, arr) => {
            const prior = arr[i - 1];
            const isPriorNegativeOperator = prior instanceof OperatorTerm && prior.operator === "-";

            if (t instanceof NumericTerm) {
              const isNegative =
                (t.number <= 0 && !isPriorNegativeOperator) || (t.number >= 0 && isPriorNegativeOperator);
              if (isNegative) {
                if (prior instanceof OperatorTerm) parts.pop();
              } else {
                if (t.flavor) parts.push(`${t.number}[${t.flavor}]`);
                else parts.push(`${t.number}`);
              }
            } else parts.push(t.formula);
          });
          roll.roll = await RollPF.create(parts.join(" "), rollData).evaluate({ async: true });
        }
        rolls.push(roll);
      } catch (err) {
        console.error("Error with damage formula:", formula, this);
        throw err;
      }
    }

    return rolls;
  }
}
