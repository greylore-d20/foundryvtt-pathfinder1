export class ChatAttack {
  constructor(item, {label="", rollData={}, primaryAttack=true}={}) {
    this._baseRollData = rollData;
    this.primaryAttack = primaryAttack;
    this.setItem(item);
    this.label = label;

    this.attack = {
      flavor: "",
      tooltip: "",
      total: 0,
      isCrit: false,
      isFumble: false,
      roll: null,
    };
    this.critConfirm = {
      flavor: "",
      tooltip: "",
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
      flavor : "",
      tooltip: "",
      total  : 0,
      rolls: [],
      parts: [],
    };
    this.hasDamage = false;

    this.cards           = {};
    this.hasCards        = false;
    this.attackNotes     = [];
    this.effectNotes     = [];
    this.attackNotesHTML = "";
    this.effectNotesHTML = "";
  }

  get critRange() {
    if (this.item.data.data.broken) return 1;
    return getProperty(this.item, "data.data.ability.critRange") || 20;
  }

  /**
   * Sets the attack's item reference.
   * @param {ItemPF} item - The item to reference.
   */
  setItem(item) {
    if (item == null) {
      this.rollData = {};
      this.item = null;
      return;
    }

    this.item = item;
    this.rollData = item.actor != null ? item.actor.getRollData() : {};
    this.rollData.item = duplicate(this.item.data.data);
    this.rollData = mergeObject(this.rollData, this._baseRollData);

    this.setRollData();
  }

  /**
   * Applies changes to the roll data.
   */
  setRollData() {
    let data = this.rollData;
    // Set critical hit multiplier
    data.critMult = 1;
    data.critCount = 0;
    // Add critical confirmation bonus
    data.critConfirmBonus = data.item.critConfirmBonus;
    // Determine ability multiplier
    if (data.item.ability.damageMult != null) data.ablMult = data.item.ability.damageMult;
    // Lower ability multiplier for secondary attacks
    if (this.primaryAttack === false && getProperty(data.ablMult > 0)) {
      data.ablMult = 0.5;
    }
  }

  setAttackNotesHTML() {
    if (this.attackNotes.length === 0) {
      this.attackNotesHTML = "";
      return;
    }

    let result = "";
    for (let n of this.attackNotes) {
      if (n.length > 0) {
        result += `<span class="tag">${n}</span>`;
      }
    }
    const inner = TextEditor.enrichHTML(result, { rollData: this.rollData });
    this.attackNotesHTML =  `<div class="flexcol property-group gm-sensitive"><label>${game.i18n.localize("PF1.AttackNotes")}</label><div class="flexrow">${inner}</div></div>`;
  }

  setEffectNotesHTML() {
    if (this.effectNotes.length === 0) {
      this.effectNotesHTML = "";
      return;
    }

    let result = "";
    for (let n of this.effectNotes) {
      if (n.length > 0) {
        result += `<span class="tag">${n}</span>`;
      }
    }
    const inner = TextEditor.enrichHTML(result, { rollData: this.rollData });
    this.effectNotesHTML = `<div class="flexcol property-group gm-sensitive"><label>${game.i18n.localize("PF1.EffectNotes")}</label><div class="flexrow">${inner}</div></div>`;
  }

  async addAttack({bonus=null, extraParts=[], critical=false}={}) {
    if (!this.item) return;

    this.hasAttack = true;
    let data = this.attack;
    if (critical === true) {
      data = this.critConfirm;
      extraParts.push("@critConfirmBonus");
    }

    // Add broken penalty
    if (this.item.data.data.broken && !critical) {
      extraParts.push("-2");
    }

    // Roll attack
    let roll = this.item.rollAttack({data: this.rollData, bonus: bonus, extraParts: extraParts, primaryAttack: this.primaryAttack });
    data.roll = roll;
    let d20 = roll.parts[0];
    let critType = 0;
    if ((d20.total >= this.critRange && !critical) || (d20.total === 20 && critical)) critType = 1;
    else if (d20.total === 1) critType = 2;

    // Add tooltip
    let tooltip   = $(await roll.getTooltip()).prepend(`<div class="dice-formula">${roll.formula}</div>`)[0].outerHTML;
    data.flavor   = critical ? game.i18n.localize("PF1.CriticalConfirmation") : this.label;
    data.tooltip  = tooltip;
    data.total    = roll.total;
    data.isCrit   = critType === 1;
    data.isFumble = critType === 2;

    // Add crit confirm
    if (!critical && d20.total >= this.critRange) {
      this.hasCritConfirm    = true;
      this.rollData.critMult = Math.max(1, this.rollData.item.ability.critMult - 1);
      if (this.item.data.data.broken) this.rollData.critMult = 1;

      await this.addAttack({bonus: bonus, extraParts: extraParts, critical: true});
    }

    if (this.attackNotes === "") this.addAttackNotes();
  }

  addAttackNotes() {
    if (!this.item) return;

    let notes = [];
    if (this.item != null && this.item.actor != null) {
      notes.push(...this.item.actor.getContextNotesParsed("attacks.attack"));
    }
    if (this.item != null && this.item.data.data.attackNotes) {
      notes.push(...this.item.data.data.attackNotes.split(/[\n\r]+/));
    }

    this.attackNotes = notes;
    this.setAttackNotesHTML();
  }

  async addDamage({extraParts=[], critical=false}={}) {
    if (!this.item) return;

    this.hasDamage = true;
    let data = this.damage;
    if (critical === true) data = this.critDamage;

    let rollData = duplicate(this.rollData);
    // Enforce critical multiplier
    rollData.critCount = 0;
    if (!critical) {
      rollData.critMult = 1;
    }
    // Add normal damage to critical damage
    else if (critical) {
      const normalParts = this.damage.parts;
      data.parts.push(...normalParts);
    }
    
    // Roll damage
    const repeatCount = critical ? Math.max(1, rollData.critMult) : 1;
    for (let repeat = 0; repeat < repeatCount; ++repeat) {
      if (critical) rollData.critCount++;
      const rolls = this.item.rollDamage({data: rollData, extraParts: extraParts, primaryAttack: this.primaryAttack, critical: critical});
      data.rolls = rolls;
      // Add damage parts
      for (let roll of rolls) {
        const dtype = roll.damageType;
        data.parts.push(new DamagePart(roll.roll.total, dtype, roll.roll, roll.type));
      }
    }

    // Consolidate damage parts based on damage type
    let tooltips = "";
    let consolidatedParts = data.parts.reduce((cur, o) => {
      if (!cur[o.damageType]) {
        cur[o.damageType] = new DamagePart(o.amount, o.damageType, o.rolls.slice(), critical ? "critical" : o.type);
      }
      else {
        cur[o.damageType].amount += o.amount;
        cur[o.damageType].rolls.push(...o.rolls);
      }
      return cur;
    }, {});

    // Add tooltip
    for (let p of Object.values(consolidatedParts)) {
      tooltips += await renderTemplate("systems/pf1/templates/internal/damage-tooltip.html", {
        part: p,
      });
    }

    // Add normal data
    let flavor;
    if (!critical) flavor = this.item.isHealing ? game.i18n.localize("PF1.Healing")         : game.i18n.localize("PF1.Damage");
    else           flavor = this.item.isHealing ? game.i18n.localize("PF1.HealingCritical") : game.i18n.localize("PF1.DamageCritical");

    // Add card
    const totalDamage = data.parts.reduce((cur, p) => {
      return cur + p.amount;
    }, 0);
    if (critical) {
      if (!this.cards.critical) this.cards.critical = { label: game.i18n.localize(this.item.isHealing ? "PF1.HealingCritical" : "PF1.DamageCritical"), items: [] };
      if (this.item.isHealing) {
        this.cards.critical.items.push({ label: game.i18n.localize("PF1.Apply"), value: -totalDamage, action: "applyDamage", });
        this.cards.critical.items.push({ label: game.i18n.localize("PF1.ApplyHalf"), value: -Math.floor(totalDamage / 2), action: "applyDamage", });
      }
      else {
        this.cards.critical.items.push({ label: game.i18n.localize("PF1.Apply"), value: totalDamage, action: "applyDamage", });
        this.cards.critical.items.push({ label: game.i18n.localize("PF1.ApplyHalf"), value: Math.floor(totalDamage / 2), action: "applyDamage", });
      }
    }
    else {
      if (!this.cards.damage)  this.cards.damage = { label: game.i18n.localize(this.item.isHealing ? "PF1.Healing" : "PF1.Damage"), items: [] };
      if (this.item.isHealing) {
        this.cards.damage.items.push({ label: game.i18n.localize("PF1.Apply"), value: -totalDamage, action: "applyDamage", });
        this.cards.damage.items.push({ label: game.i18n.localize("PF1.ApplyHalf"), value: -Math.floor(totalDamage / 2), action: "applyDamage", });
      }
      else {
        this.cards.damage.items.push({ label: game.i18n.localize("PF1.Apply"), value: totalDamage, action: "applyDamage", });
        this.cards.damage.items.push({ label: game.i18n.localize("PF1.ApplyHalf"), value: Math.floor(totalDamage / 2), action: "applyDamage", });
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
        for (let n of o.notes) {
          arr.push(...n.split(/[\n\r]+/));
        }
        return arr;
      }, []);
    }
    if (this.item != null && this.item.data.data.effectNotes) {
      notes.push(...this.item.data.data.effectNotes.split(/[\n\r]+/));
    }

    this.effectNotes = notes;
    this.setEffectNotesHTML();
  }

  finalize() {
    this.hasCards = Object.keys(this.cards).length > 0;

    return this;
  }
}

export class DamagePart {
  constructor(amount, damageType, rolls, type="normal") {
    this.amount = amount;
    this.damageType = damageType;
    if (!this.damageType) this.damageType = "Untyped";
    this.type = type;
    this.rolls = [];
    
    if (rolls != null) {
      if (!(rolls instanceof Array)) rolls = [rolls];
      this.rolls = rolls;
    }
  }
}
