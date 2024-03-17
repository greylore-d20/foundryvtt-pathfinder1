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
      get half() {
        return Math.floor(this.total / 2);
      },
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
    this.effectNotes = [];
    this.effectNotesHTML = "";
    this.targets = targets;
    this.ammo = null;
  }

  /** @type {Actor} */
  get actor() {
    return this.action?.actor;
  }

  setAmmo(ammoId) {
    if (ammoId == null) {
      this.ammo = null;
    } else {
      const ammoItem = this.actor.items.get(ammoId);
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
    data.critConfirmBonus = RollPF.safeRoll(data.action.critConfirmBonus || "0").total ?? 0;
    // Determine ability multiplier
    if (data.action.ability.damageMult != null) data.ablMult = data.action.ability.damageMult;
  }

  async setEffectNotesHTML() {
    if (this.effectNotes.length === 0) {
      this.effectNotesHTML = "";
      return;
    }

    const rollData = this.rollData;
    const enrichOptions = {
      rollData,
      async: true,
      relativeTo: this.action.actor,
    };

    const content = await renderTemplate("systems/pf1/templates/chat/parts/item-notes.hbs", {
      notes: this.effectNotes,
      css: "effect-notes",
      title: "PF1.EffectNotes",
    });

    this.effectNotesHTML = await TextEditor.enrichHTML(content, enrichOptions);
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
  }

  async addDamage({ flavor = null, extraParts = [], critical = false, conditionalParts = {} } = {}) {
    if (!this.action.item) return;

    this.hasDamage = true;
    this.notesOnly = false;
    let data = this.damage;
    if (critical === true) data = this.critDamage;

    const rollData = foundry.utils.deepClone(this.rollData);
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

  async addEffectNotes() {
    this.effectNotes = [];

    const item = this.action.item;
    if (!item) return;

    const actor = item.actor;

    if (actor) {
      const noteSources = ["attacks.effect"];
      if (item.type === "spell") noteSources.push("spell.effect"); // Spell specific notes

      for (const source of noteSources) {
        actor.getContextNotes(source).forEach((ns) => {
          for (const note of ns.notes) this.effectNotes.push(...note.split(/[\n\r]+/));
        });
      }
    }

    // Add item notes
    if (item.system.effectNotes?.length) {
      this.effectNotes.push(...item.system.effectNotes);
    }
    // Add action notes
    if (this.action.data.effectNotes?.length) {
      this.effectNotes.push(...this.action.data.effectNotes);
    }

    await this.setEffectNotesHTML();
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
