export class ChatAttack {
  constructor(item, { label = "", primaryAttack = true, rollData = {} } = {}) {
    this.primaryAttack = primaryAttack;
    this._rollData = rollData;
    this.setItem(item);
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
    this.hasRange = item.hasRange;
    this.minimumDamage = false;
    this.damageRows = [];

    this.notesOnly = true;

    this.cards = {};
    this.hasCards = false;
    this.attackNotes = [];
    this.effectNotes = [];
    this.attackNotesHTML = "";
    this.effectNotesHTML = "";
  }

  get critRange() {
    if (this.item.data.data.broken) return 20;
    return getProperty(this.item, "data.data.ability.critRange") || 20;
  }

  /**
   * Sets the attack's item reference.
   *
   * @param {ItemPF} item - The item to reference.
   */
  setItem(item) {
    if (item == null) {
      this.rollData = this._rollData;
      this.attackType = "";
      this.item = null;
      return;
    }

    this.item = item;
    this.rollData = mergeObject(duplicate(this.item.getRollData()), this._rollData);
    this.attackType = getProperty(item.data, "data.attackType") ?? "";

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
    data.critConfirmBonus = RollPF.safeTotal(data.item.critConfirmBonus || "0") ?? 0;
    // Determine ability multiplier
    if (data.item.ability.damageMult != null) data.ablMult = data.item.ability.damageMult;
    // Lower ability multiplier for secondary attacks
    if (this.attackType === "natural" && this.primaryAttack === false && getProperty(data.ablMult > 0)) {
      data.ablMult = 0.5;
    }
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
    )}</label><div class="flexrow">${inner}</div></div>`;
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
    )}</label><div class="flexrow">${inner}</div></div>`;
  }

  async addAttack({ bonus = null, extraParts = [], critical = false, conditionalParts = {} } = {}) {
    if (!this.item) return;

    this.hasAttack = true;
    this.notesOnly = false;
    let data = this.attack;
    if (critical === true) {
      data = this.critConfirm;
      if (this.rollData.critConfirmBonus !== 0) {
        extraParts.push(`@critConfirmBonus[${game.i18n.localize("PF1.CriticalConfirmation")}]`);
      }

      const ccKey = game.pf1.utils.getChangeFlat.call(this.item, "critConfirm");
      this.item.parentActor?.sourceDetails[ccKey]?.forEach((c) => extraParts.push(`(${c.value})[${c.name}]`));

      // Add conditionals for critical confirmation
      if (conditionalParts["attack.crit"]?.length) extraParts.push(...conditionalParts["attack.crit"]);
    } else {
      // Add conditional attack bonus
      if (conditionalParts["attack.normal"]?.length) extraParts.push(...conditionalParts["attack.normal"]);
    }

    // Add broken penalty
    if (this.item.data.data.broken && !critical) {
      const label = game.i18n.localize("PF1.Broken");
      extraParts.push(`-2[${label}]`);
    }

    // Roll attack
    const roll = this.item.rollAttack({
      data: this.rollData,
      bonus: bonus,
      extraParts: extraParts,
      primaryAttack: this.attackType === "natural" ? this.primaryAttack : true,
    });
    data.roll = roll;
    const d20 = roll.dice.length ? roll.dice[0].total : roll.terms[0].total;
    let critType = 0;
    const isCmb = ["mcman", "rcman"].includes(this.item.data.data.actionType);
    if ((d20 >= this.critRange && !critical && !isCmb) || (d20 === 20 && (critical || isCmb))) critType = 1;
    else if (d20 === 1) critType = 2;

    // Add tooltip
    data.flavor = critical ? game.i18n.localize("PF1.CriticalConfirmation") : this.label;
    data.total = roll.total;
    data.isCrit = critType === 1;
    data.isFumble = critType === 2;
    data.isNat20 = d20 === 20;
    data.rollJSON = escape(JSON.stringify(roll));
    data.formula = roll.formula;

    // Add crit confirm
    if (!critical && !isCmb && d20 >= this.critRange && this.rollData.item.ability.critMult > 1) {
      this.hasCritConfirm = true;
      this.rollData.critMult = Math.max(1, this.rollData.item.ability.critMult);
      if (this.item.data.data.broken) this.rollData.critMult = 1;

      await this.addAttack({ bonus: bonus, extraParts: extraParts, critical: true, conditionalParts });
    }

    if (this.attackNotes === "") this.addAttackNotes();
  }

  addAttackNotes() {
    if (!this.item) return;

    const type = this.item.data.data.actionType;
    const typeMap = {
      rsak: ["ranged", /*"spell",*/ "rangedSpell"],
      rwak: ["ranged", /*"weapon",*/ "rangedWeapon"],
      rcman: ["ranged"],
      mwak: ["melee", /*"weapon",*/ "meleeWeapon"],
      msak: ["melee", /*"spell",*/ "meleeSpell"],
      mcman: ["melee"],
    };

    const notes = [];
    if (this.item != null && this.item.actor != null) {
      notes.push(...this.item.actor.getContextNotesParsed("attacks.attack"));
      if ((typeMap[type]?.length || 0) > 0)
        typeMap[type].forEach((subTarget) =>
          notes.push(...this.item.actor.getContextNotesParsed(`attacks.${subTarget}`))
        );
    }
    if (this.item != null && this.item.data.data.attackNotes) {
      notes.push(...this.item.data.data.attackNotes);
    }
    if (["mcman", "rcman"].includes(this.item?.data.data.actionType)) {
      notes.push(...this.item?.actor?.getContextNotesParsed("misc.cmb"));
    }

    this.attackNotes = notes;
    this.setAttackNotesHTML();
  }

  async addDamage({ extraParts = [], critical = false, conditionalParts = {} } = {}) {
    if (!this.item) return;

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
      const rolls = this.item.rollDamage({
        data: rollData,
        extraParts: extraParts,
        primaryAttack: this.attackType === "natural" ? this.primaryAttack : true,
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
    let flavor;
    if (!critical) flavor = this.item.isHealing ? game.i18n.localize("PF1.Healing") : game.i18n.localize("PF1.Damage");
    else
      flavor = this.item.isHealing
        ? game.i18n.localize("PF1.HealingCritical")
        : game.i18n.localize("PF1.DamageCritical");

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
    }

    // Handle nonlethal attacks
    if (this.item.data.data.nonlethal) flavor = game.i18n.localize("PF1.Nonlethal");

    // Add card
    if (critical) {
      if (!this.cards.critical)
        this.cards.critical = {
          label: game.i18n.localize(this.item.isHealing ? "PF1.HealingCritical" : "PF1.DamageCritical"),
          items: [],
        };
      if (this.item.isHealing) {
        this.cards.critical.items.push({
          label: game.i18n.localize("PF1.Apply"),
          value: -totalDamage,
          action: "applyDamage",
        });
        this.cards.critical.items.push({
          label: game.i18n.localize("PF1.ApplyHalf"),
          value: -Math.floor(totalDamage / 2),
          action: "applyDamage",
        });
      } else {
        this.cards.critical.items.push({
          label: game.i18n.localize("PF1.Apply"),
          value: totalDamage,
          action: "applyDamage",
          tags: minimumDamage ? "nonlethal" : "",
        });
        this.cards.critical.items.push({
          label: game.i18n.localize("PF1.ApplyHalf"),
          value: Math.floor(totalDamage / 2),
          action: "applyDamage",
          tags: minimumDamage ? "nonlethal" : "",
        });
      }
    } else {
      if (!this.cards.damage)
        this.cards.damage = {
          label: game.i18n.localize(this.item.isHealing ? "PF1.Healing" : "PF1.Damage"),
          items: [],
        };
      if (this.item.isHealing) {
        this.cards.damage.items.push({
          label: game.i18n.localize("PF1.Apply"),
          value: -totalDamage,
          action: "applyDamage",
        });
        this.cards.damage.items.push({
          label: game.i18n.localize("PF1.ApplyHalf"),
          value: -Math.floor(totalDamage / 2),
          action: "applyDamage",
        });
      } else {
        this.cards.damage.items.push({
          label: game.i18n.localize("PF1.Apply"),
          value: totalDamage,
          action: "applyDamage",
          tags: minimumDamage ? "nonlethal" : "",
        });
        this.cards.damage.items.push({
          label: game.i18n.localize("PF1.ApplyHalf"),
          value: Math.floor(totalDamage / 2),
          action: "applyDamage",
          tags: minimumDamage ? "nonlethal" : "",
        });
      }
    }

    // Finalize data
    data.flavor = flavor;
    data.tooltip = tooltips;
    data.total = totalDamage;
  }

  addEffectNotes() {
    if (!this.item) return;

    let notes = [];
    if (this.item != null && this.item.actor != null) {
      notes = this.item.actor.getContextNotes("attacks.effect").reduce((arr, o) => {
        for (const n of o.notes) {
          arr.push(...n.split(/[\n\r]+/));
        }
        return arr;
      }, []);

      // Spell specific notes
      if (this.item.type === "spell") {
        this.item.actor.getContextNotes("spell.effect").forEach((o) => {
          for (const n of o.notes) notes.push(...n.split(/[\n\r]+/));
        });
      }
    }

    if (this.item != null && this.item.data.data.effectNotes) {
      notes.push(...this.item.data.data.effectNotes);
    }

    this.effectNotes = notes;
    this.setEffectNotesHTML();
  }

  addAmmunitionCards() {
    this.cards.recoverAmmo = { label: game.i18n.localize("PF1.RecoverAmmunition"), items: [] };
    this.cards.recoverAmmo.items.push({ label: game.i18n.localize("PF1.Recover"), action: "recoverAmmo" });
    this.cards.recoverAmmo.items.push({ label: game.i18n.localize("PF1.ForceRecover"), action: "forceRecoverAmmo" });
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
    this.damageType = damageType;
    if (!this.damageType) this.damageType = "Untyped";
    this.type = type;
    this.roll = {
      json: escape(JSON.stringify(roll)),
      formula: roll.formula,
      total: roll.total,
    };
  }
}
