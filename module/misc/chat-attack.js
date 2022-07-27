import { RollPF } from "../roll.js";

export class ChatAttack {
  constructor(action, { label = "", rollData = {}, targets = null } = {}) {
    this._rollData = rollData;
    this.setAction(action);
    this.label = label;

    this.attack = {
      flavor: "",
      total: 0,
      isCrit: false,
      isFumble: false,
      roll: null,
    };
    this.critConfirm = {
      flavor: "",
      total: 0,
      isCrit: false,
      isFumble: false,
      roll: null,
    };
    this.hasAttack = false;
    this.hasCritConfirm = false;

    this.damage = {
      flavor: "",
      tooltip: "",
      total: 0,
      rolls: [],
      parts: [],
    };
    this.critDamage = {
      flavor: "",
      tooltip: "",
      total: 0,
      rolls: [],
      parts: [],
    };
    this.hasDamage = false;
    this.hasRange = action.item.hasRange;
    this.minimumDamage = false;
    this.nonlethal = false;
    this.damageRows = [];

    this.notesOnly = true;

    this.cards = {};
    this.hasCards = false;
    this.attackNotes = [];
    this.effectNotes = [];
    this.attackNotesHTML = "";
    this.effectNotesHTML = "";
    this.targets = targets;
    this.ammo = null;
  }

  setAmmo(ammoId) {
    if (ammoId == null) {
      this.ammo = null;
    } else {
      const ammoItem = this.action.item.actor?.items.get(ammoId);
      if (ammoItem == null) {
        this.ammo = null;
        return;
      }

      this.ammo = {
        id: ammoId,
        img: ammoItem.img,
        name: ammoItem.name,
      };
    }
  }

  get critRange() {
    if (this.action.item.data.data.broken) return 20;
    return getProperty(this.action, "data.ability.critRange") || 20;
  }

  /**
   * Sets the attack's item reference.
   *
   * @param {ItemAction} item - The action to reference.
   * @param action
   */
  setAction(action) {
    if (action == null) {
      this.rollData = this._rollData;
      this.attackType = "";
      this.action = null;
      return;
    }

    this.action = action;
    this.rollData = mergeObject(this.action.getRollData(), this._rollData, { inplace: false });
    this.attackType = getProperty(action.data, "data.attackType") ?? "";
    this.isHealing = action.isHealing;

    this.setRollData();
  }

  /**
   * Applies changes to the roll data.
   */
  setRollData() {
    const data = this.rollData;
    // Set critical hit multiplier
    data.critMult = 1;
    data.critCount = 0;
    // Add critical confirmation bonus
    data.critConfirmBonus = RollPF.safeTotal(data.action.critConfirmBonus || "0") ?? 0;
    // Determine ability multiplier
    if (data.action.ability.damageMult != null) data.ablMult = data.action.ability.damageMult;
  }

  setAttackNotesHTML() {
    if (this.attackNotes.length === 0) {
      this.attackNotesHTML = "";
      return;
    }

    let result = "";
    for (const n of this.attackNotes) {
      if (n.length > 0) {
        result += `<span class="tag">${n}</span>`;
      }
    }
    const inner = TextEditor.enrichHTML(result, { rollData: this.rollData });
    this.attackNotesHTML = `<div class="flexcol property-group gm-sensitive attack-notes"><label>${game.i18n.localize(
      "PF1.AttackNotes"
    )}</label><div class="flexrow tag-list">${inner}</div></div>`;
  }

  setEffectNotesHTML() {
    if (this.effectNotes.length === 0) {
      this.effectNotesHTML = "";
      return;
    }

    let result = "";
    for (const n of this.effectNotes) {
      if (n.length > 0) {
        result += `<span class="tag">${n}</span>`;
      }
    }
    const inner = TextEditor.enrichHTML(result, { rollData: this.rollData });
    this.effectNotesHTML = `<div class="flexcol property-group gm-sensitive effect-notes"><label>${game.i18n.localize(
      "PF1.EffectNotes"
    )}</label><div class="flexrow tag-list">${inner}</div></div>`;
  }

  async addAttack({ noAttack = false, bonus = null, extraParts = [], critical = false, conditionalParts = {} } = {}) {
    if (!this.action.item) return;

    this.hasAttack = true;
    this.notesOnly = false;
    let data = this.attack;
    if (critical === true) {
      data = this.critConfirm;
      if (this.rollData.critConfirmBonus !== 0) {
        extraParts.push(`@critConfirmBonus[${game.i18n.localize("PF1.CriticalConfirmation")}]`);
      }

      const ccKey = game.pf1.utils.getChangeFlat.call(this.action.item, "critConfirm");
      this.action.item.parentActor?.sourceDetails[ccKey]?.forEach((c) => extraParts.push(`(${c.value})[${c.name}]`));

      // Add conditionals for critical confirmation
      if (conditionalParts["attack.crit"]?.length) extraParts.push(...conditionalParts["attack.crit"]);
    } else {
      // Add conditional attack bonus
      if (conditionalParts["attack.normal"]?.length) extraParts.push(...conditionalParts["attack.normal"]);
    }

    // Add broken penalty
    if (this.action.item.data.data.broken && !critical) {
      const label = game.i18n.localize("PF1.Broken");
      extraParts.push(`-2[${label}]`);
    }

    // Roll attack
    if (!noAttack) {
      const roll = await this.action.rollAttack({
        data: this.rollData,
        bonus: bonus,
        extraParts: extraParts,
      });
      data.roll = roll;
      const d20 = roll.dice.length ? roll.dice[0].total : roll.terms[0].total;
      let critType = 0;
      const isCmb = ["mcman", "rcman"].includes(this.action.data.actionType);
      if ((d20 >= this.critRange && !critical && !isCmb) || (d20 === 20 && (critical || isCmb))) critType = 1;
      else if (d20 === 1) critType = 2;

      data.total = roll.total;
      data.isCrit = critType === 1;
      data.isFumble = critType === 2;
      data.isNat20 = d20 === 20;
      data.formula = roll.formula;

      // Add crit confirm
      if (!critical && !isCmb && d20 >= this.critRange && this.rollData.action.ability.critMult > 1) {
        this.hasCritConfirm = true;
        this.rollData.critMult = Math.max(1, this.rollData.action.ability.critMult);
        if (this.action.item.data.data.broken) this.rollData.critMult = 1;

        await this.addAttack({ bonus: bonus, extraParts: extraParts, critical: true, conditionalParts });
      }
    }

    // Add tooltip
    data.flavor = critical ? game.i18n.localize("PF1.CriticalConfirmation") : this.label;

    if (this.attackNotes === "") this.addAttackNotes();
  }

  addAttackNotes() {
    if (!this.action.item) return;

    const type = this.action.data.actionType;
    const typeMap = {
      rsak: ["ranged", /*"spell",*/ "rangedSpell"],
      rwak: ["ranged", /*"weapon",*/ "rangedWeapon"],
      rcman: ["ranged"],
      mwak: ["melee", /*"weapon",*/ "meleeWeapon"],
      msak: ["melee", /*"spell",*/ "meleeSpell"],
      mcman: ["melee"],
    };

    const notes = [];
    // Add actor notes
    if (this.action.item != null && this.action.item.actor != null) {
      notes.push(...this.action.item.actor.getContextNotesParsed("attacks.attack"));
      if ((typeMap[type]?.length || 0) > 0)
        typeMap[type].forEach((subTarget) =>
          notes.push(...this.action.item.actor.getContextNotesParsed(`attacks.${subTarget}`))
        );
    }
    // Add item notes
    if (this.action.item != null && this.action.item.data.data.attackNotes) {
      notes.push(...this.action.item.data.data.attackNotes);
    }
    // Add action notes
    if (this.action.data.attackNotes) {
      notes.push(...this.action.data.attackNotes);
    }
    // Add CMB notes
    if (["mcman", "rcman"].includes(this.action.item?.data.data.actionType)) {
      notes.push(...(this.action.item?.actor?.getContextNotesParsed("misc.cmb") ?? []));
    }

    this.attackNotes = notes;
    this.setAttackNotesHTML();
  }

  async addDamage({ flavor = null, extraParts = [], critical = false, conditionalParts = {} } = {}) {
    if (!this.action.item) return;

    this.hasDamage = true;
    this.notesOnly = false;
    let data = this.damage;
    if (critical === true) data = this.critDamage;

    const rollData = duplicate(this.rollData);
    // Enforce critical multiplier
    rollData.critCount = 0;

    // Roll damage
    const repeatCount = critical ? Math.max(1, rollData.critMult - 1) : 1;
    for (let repeat = 0; repeat < repeatCount; ++repeat) {
      if (critical) rollData.critCount++;
      const rolls = await this.action.rollDamage({
        data: rollData,
        extraParts: extraParts,
        critical: critical,
        conditionalParts,
      });
      data.rolls = rolls;
      // Add damage parts
      for (const roll of rolls) {
        const dtype = roll.damageType;
        data.parts.push(new DamagePart(roll.roll.total, dtype, roll.roll, roll.type));
      }
    }

    // Consolidate damage parts based on damage type
    let tooltips = "";

    // Add tooltip
    for (const p of Object.values(data.parts)) {
      tooltips += await renderTemplate("systems/pf1/templates/internal/damage-tooltip.hbs", {
        part: p,
      });
    }

    // Add normal data
    if (!flavor) {
      if (!critical) flavor = this.isHealing ? game.i18n.localize("PF1.Healing") : game.i18n.localize("PF1.Damage");
      else
        flavor = this.isHealing ? game.i18n.localize("PF1.HealingCritical") : game.i18n.localize("PF1.DamageCritical");
    }

    // Determine total damage
    let totalDamage = data.parts.reduce((cur, p) => {
      return cur + p.amount;
    }, 0);
    if (critical) {
      totalDamage = this.damage.parts.reduce((cur, p) => {
        return cur + p.amount;
      }, totalDamage);
    }

    // Handle minimum damage rule
    let minimumDamage = false;
    if (totalDamage < 1) {
      totalDamage = 1;
      minimumDamage = true;
      flavor = game.i18n.localize("PF1.Nonlethal");
      this.nonlethal = true;
    }

    // Handle nonlethal attacks
    if (this.action.data.nonlethal || this.action.item.data.data.properties?.nnl) {
      this.nonlethal = true;
      flavor = game.i18n.localize("PF1.Nonlethal");
    }

    // Finalize data
    data.flavor = flavor;
    data.tooltip = tooltips;
    data.total = totalDamage;
  }

  addEffectNotes() {
    if (!this.action.item) return;

    let notes = [];
    if (this.action.item != null && this.action.item.actor != null) {
      notes = this.action.item.actor.getContextNotes("attacks.effect").reduce((arr, o) => {
        for (const n of o.notes) {
          arr.push(...n.split(/[\n\r]+/));
        }
        return arr;
      }, []);

      // Spell specific notes
      if (this.action.item.type === "spell") {
        this.action.item.actor.getContextNotes("spell.effect").forEach((o) => {
          for (const n of o.notes) notes.push(...n.split(/[\n\r]+/));
        });
      }
    }

    // Add item notes
    if (this.action.item != null && this.action.item.data.data.effectNotes) {
      notes.push(...this.action.item.data.data.effectNotes);
    }
    // Add action notes
    if (this.action.data.effectNotes) {
      notes.push(...this.action.data.effectNotes);
    }

    this.effectNotes = this.effectNotes.concat(notes);
    this.setEffectNotesHTML();
  }

  finalize() {
    this.hasCards = Object.keys(this.cards).length > 0;

    // Determine damage rows for chat cards
    // this.damageRows = [];
    for (let a = 0; a < Math.max(this.damage.parts.length, this.critDamage.parts.length); a++) {
      this.damageRows.push({ normal: null, crit: null });
    }
    for (let a = 0; a < this.damage.parts.length; a++) {
      this.damageRows[a].normal = this.damage.parts[a];
    }
    for (let a = 0; a < this.critDamage.parts.length; a++) {
      this.damageRows[a].crit = this.critDamage.parts[a];
    }

    return this;
  }
}

export class DamagePart {
  constructor(amount, damageType, roll, type = "normal") {
    this.amount = amount;
    this.damageType = damageType ?? "Untyped";
    this.type = type;
    this.roll = roll;
  }
}
