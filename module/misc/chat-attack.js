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
    };
    this.critDamage = {
      flavor : "",
      tooltip: "",
      total  : 0,
      rolls: [],
    };
    this.hasDamage = false;

    this.cards           = [];
    this.attackNotes     = [];
    this.effectNotes     = [];
    this.attackNotesHTML = "";
    this.effectNotesHTML = "";
  }

  get critRange() {
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
      this.rollData.critMult = this.rollData.item.ability.critMult;

      await this.addAttack({bonus: bonus, extraParts: extraParts, critical: true});
    }

    if (this.attackNotes === "") this.addAttackNotes();
  }

  addAttackNotes() {
    if (!this.item) return;

    let notes = [];
    if (this.item != null && this.item.actor != null) {
      notes = this.item.actor.getContextNotes("attacks.attack").reduce((arr, o) => {
        for (let n of o.notes) {
          arr.push(...n.split(/[\n\r]+/));
        }
        return arr;
      }, []);
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
    if (!critical) rollData.critMult = 1;
    
    const rolls = this.item.rollDamage({data: rollData, extraParts: extraParts, primaryAttack: this.primaryAttack, critical: critical});
    data.rolls = rolls;
    // Add tooltip
    let tooltips = "";
    let totalDamage = 0;
    for (let roll of rolls) {
      let tooltip = $(await roll.roll.getTooltip()).prepend(`<div class="dice-formula">${roll.roll.formula}</div>`)[0].outerHTML;
      // Alter tooltip
      let tooltipHtml = $(tooltip);
      totalDamage += roll.roll.total;
      let totalText = roll.roll.total.toString();
      if (roll.damageType.length) totalText += ` (${roll.damageType})`;
      tooltipHtml.find(".part-total").text(totalText);
      tooltip = tooltipHtml[0].outerHTML;
      
      tooltips += tooltip;
    }
    // Add normal data
    let flavor;
    if (!critical) flavor = this.item.isHealing ? game.i18n.localize("PF1.Healing")         : game.i18n.localize("PF1.Damage");
    else           flavor = this.item.isHealing ? game.i18n.localize("PF1.HealingCritical") : game.i18n.localize("PF1.DamageCritical");
    let damageTypes = this.item.data.data.damage.parts.reduce((cur, o) => {
      if (o[1] !== "" && cur.indexOf(o[1]) === -1) cur.push(o[1]);
      return cur;
    }, []);
    // Add critical damage parts
    if (critical === true && getProperty(this.item.data, "data.damage.critParts") != null) {
      damageTypes.push(this.item.data.data.damage.critParts.reduce((cur, o) => {
        if (o[1] !== "" && cur.indexOf(o[1]) === -1) cur.push(o[1]);
        return cur;
      }, []));
    }

    // Add card
    if (critical) {
      if (this.item.isHealing) this.cards.push({ label: game.i18n.localize("PF1.ApplyCriticalHealing"), value: -totalDamage, action: "applyDamage", });
      else                     this.cards.push({ label: game.i18n.localize("PF1.ApplyCriticalDamage") , value:  totalDamage, action: "applyDamage", });
    }
    else {
      if (this.item.isHealing) this.cards.push({ label: game.i18n.localize("PF1.ApplyHealing"), value: -totalDamage, action: "applyDamage", });
      else                     this.cards.push({ label: game.i18n.localize("PF1.ApplyDamage") , value:  totalDamage, action: "applyDamage", });
    }

    data.flavor = damageTypes.length > 0 ? `${flavor} (${damageTypes.join(", ")})` : flavor;
    data.tooltip = tooltips;
    data.total = rolls.reduce((cur, roll) => {
      return cur + roll.roll.total;
    }, 0);
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
}
