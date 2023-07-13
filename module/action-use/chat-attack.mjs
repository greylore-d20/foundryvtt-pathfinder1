import { RollPF } from "../dice/roll.mjs";

export class ChatAttack {
  constructor(action, { label = "", rollData = {}, targets = null } = {}) {
    this.rollData = rollData;
    this.setAction(action);
    this.label = label;

    /** @type {D20RollPF | null} */
    this.attack = null;
    /** @type {D20RollPF | null} */
    this.critConfirm = null;
    this.hasAttack = false;
    this.hasCritConfirm = false;

    this.damage = {
      flavor: "",
      total: 0,
      /** @type {DamageRoll[]} */
      rolls: [],
    };
    this.critDamage = {
      flavor: "",
      total: 0,
      /** @type {DamageRoll[]} */
      rolls: [],
    };
    this.hasDamage = false;
    this.hasRange = action.item.hasRange;
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
    if (this.action.item.system.broken) return 20;
    return this.rollData.action.ability?.critRange || 20;
  }

  /**
   * Sets the attack's item reference.
   *
   * @param {ItemAction} action - The action to reference.
   */
  setAction(action) {
    if (action == null) {
      this.rollData = null;
      this.action = null;
      return;
    }

    this.action = action;
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
    const inner = TextEditor.enrichHTML(result, { rollData: this.rollData, async: false });
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
    const inner = TextEditor.enrichHTML(result, { rollData: this.rollData, async: false });
    this.effectNotesHTML = `<div class="flexcol property-group gm-sensitive effect-notes"><label>${game.i18n.localize(
      "PF1.EffectNotes"
    )}</label><div class="flexrow tag-list">${inner}</div></div>`;
  }

  async addAttack({ noAttack = false, bonus = null, extraParts = [], critical = false, conditionalParts = {} } = {}) {
    if (!this.action.item) return;

    const actor = this.action.actor;

    this.hasAttack = true;
    this.notesOnly = false;
    /** @type {D20RollPF} */
    let roll;
    if (critical === true) {
      if (this.rollData.critConfirmBonus !== 0) {
        extraParts.push(`@critConfirmBonus[${game.i18n.localize("PF1.CriticalConfirmation")}]`);
      }

      const ccKeys = pf1.documents.actor.changes.getChangeFlat.call(actor, "critConfirm");
      for (const ccKey of ccKeys) {
        actor?.sourceDetails[ccKey]?.forEach((c) => extraParts.push(`(${c.value})[${c.name}]`));
      }

      // Add conditionals for critical confirmation
      if (conditionalParts["attack.crit"]?.length) extraParts.push(...conditionalParts["attack.crit"]);
    } else {
      // Add conditional attack bonus
      if (conditionalParts["attack.normal"]?.length) extraParts.push(...conditionalParts["attack.normal"]);
    }

    // Add broken penalty
    const broken = this.rollData.item.broken;
    if (broken && !critical) {
      const label = game.i18n.localize("PF1.Broken");
      extraParts.push(`-2[${label}]`);
    }

    // Roll attack
    if (!noAttack) {
      roll = await this.action.rollAttack({
        data: this.rollData,
        bonus: bonus,
        extraParts: extraParts,
      });

      if (critical === true) this.critConfirm = roll;
      else this.attack = roll;

      // Add crit confirm
      if (!critical && !this.action.isCombatManeuver && roll.isCrit && this.rollData.action.ability.critMult > 1) {
        this.hasCritConfirm = true;
        this.rollData.critMult = Math.max(1, this.rollData.action.ability.critMult);
        if (broken) this.rollData.critMult = 1;

        await this.addAttack({ bonus: bonus, extraParts: extraParts, critical: true, conditionalParts });
      }
    }

    // Add tooltip
    roll.options.flavor = critical ? game.i18n.localize("PF1.CriticalConfirmation") : this.label;

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
    if (this.action.item?.actor != null) {
      notes.push(...this.action.item.actor.getContextNotesParsed("attacks.attack"));
      if ((typeMap[type]?.length || 0) > 0)
        typeMap[type].forEach((subTarget) =>
          notes.push(...this.action.item.actor.getContextNotesParsed(`attacks.${subTarget}`))
        );
    }
    // Add item notes
    if (this.action.item?.system.attackNotes) {
      notes.push(...this.action.item.system.attackNotes);
    }
    // Add action notes
    if (this.action.data.attackNotes) {
      notes.push(...this.action.data.attackNotes);
    }
    // Add CMB notes
    if (this.action.isCombatManeuver) {
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
      data.rolls.push(
        ...(await this.action.rollDamage({
          data: rollData,
          extraParts: extraParts,
          critical: critical,
          conditionalParts,
        }))
      );
    }

    // Add tooltip
    let tooltips = "";
    for (const roll of data.rolls) {
      tooltips += await renderTemplate("systems/pf1/templates/internal/damage-tooltip.hbs", {
        part: roll,
      });
    }

    // Add normal data
    if (!flavor) {
      if (!critical) flavor = this.isHealing ? game.i18n.localize("PF1.Healing") : game.i18n.localize("PF1.Damage");
      else
        flavor = this.isHealing ? game.i18n.localize("PF1.HealingCritical") : game.i18n.localize("PF1.DamageCritical");
    }

    // Determine total damage
    let totalDamage = data.rolls.reduce((cur, p) => {
      return cur + p.total;
    }, 0);
    if (critical) {
      totalDamage = this.damage.rolls.reduce((cur, p) => {
        return cur + p.total;
      }, totalDamage);
    }

    // Handle minimum damage rule
    if (totalDamage < 1) {
      totalDamage = 1;
      flavor = game.i18n.localize("PF1.Nonlethal");
      this.nonlethal = true;
    }

    // Handle nonlethal attacks
    if (this.rollData.action.nonlethal || this.action.item.system.properties?.nnl) {
      this.nonlethal = true;
      flavor = game.i18n.localize("PF1.Nonlethal");
    }

    // Finalize data
    data.flavor = flavor;
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
    if (this.action.item != null && this.action.item.system.effectNotes) {
      notes.push(...this.action.item.system.effectNotes);
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
    for (let a = 0; a < Math.max(this.damage.rolls.length, this.critDamage.rolls.length); a++) {
      this.damageRows.push({ normal: null, crit: null });
    }
    for (let a = 0; a < this.damage.rolls.length; a++) {
      this.damageRows[a].normal = this.damage.rolls[a];
    }
    for (let a = 0; a < this.critDamage.rolls.length; a++) {
      this.damageRows[a].crit = this.critDamage.rolls[a];
    }

    return this;
  }
}
