import { ChatAttack } from "./chat-attack.mjs";
import { RollPF } from "../dice/roll.mjs";

// Documentation/type imports
/** @typedef {import("@item/item-pf.mjs").SharedActionData} SharedActionData */
/** @typedef {pf1.documents.item.ItemPF} ItemPF */
/** @typedef {pf1.documents.actor.ActorPF} ActorPF */
/** @typedef {pf1.components.ItemAction} ItemAction */

/**
 * Error states for when an item does not meet the requirements for an attack.
 *
 * @enum {number}
 * @readonly
 */
export const ERR_REQUIREMENT = Object.freeze({
  NO_ACTOR_PERM: 1,
  DISABLED: 2,
  INSUFFICIENT_QUANTITY: 3,
  INSUFFICIENT_CHARGES: 4,
  MISSING_AMMO: 5,
  INSUFFICIENT_AMMO: 6,
});

export class ActionUse {
  /**
   * The actor this action use is based on.
   *
   * @type {ActorPF}
   */
  actor;
  /**
   * The actor this action use is based on.
   *
   * @type {TokenDocument}
   */
  token;

  /**
   * The item this action use is based on.
   *
   * @type {ItemPF}
   */
  item;
  /**
   * The action this action use is based on.
   *
   * @type {ItemAction}
   */
  action;
  /**
   * The shared data object holding all relevant data for this action use.
   *
   * @type {SharedActionData}
   */
  shared;

  /**
   * @param {Partial<SharedActionData>} [shared={}] - The shared context for this action use
   */
  constructor(shared = {}) {
    Object.defineProperties(this, {
      shared: { value: shared },
      item: { value: shared.item },
      action: { value: shared.action },
      actor: { value: shared.item.actor },
      token: { value: shared.token },
    });

    // Init some shared data
    this.shared.templateData = {
      action: this.shared.action,
      item: this.shared.item,
    };
  }

  /**
   * @returns {Promise<number>} - 0 when successful, otherwise one of the ERR_REQUIREMENT constants.
   */
  checkRequirements() {
    const actor = this.item.actor;
    if (actor && !actor.isOwner) {
      ui.notifications.warn(game.i18n.format("PF1.Error.NoActorPermissionAlt", { name: actor.name }));
      return ERR_REQUIREMENT.NO_ACTOR_PERM;
    }

    if (this.item.type === "feat" && this.item.system.disabled) {
      ui.notifications.warn(game.i18n.localize("PF1.Error.FeatDisabled"));
      return ERR_REQUIREMENT.DISABLED;
    }

    // Cost override set to 0 or to increase charges/quantity
    if (this.shared.cost !== null && this.shared.cost <= 0) return 0;

    if (this.item.isPhysical) {
      const itemQuantity = this.item.system.quantity || 0;
      if (itemQuantity <= 0) {
        ui.notifications.warn(game.i18n.localize("PF1.Error.NoQuantity"));
        return ERR_REQUIREMENT.INSUFFICIENT_QUANTITY;
      }
    }

    if (this.action.isSelfCharged && this.action.data.uses.self?.value < 1) {
      ui.notifications.warn(
        game.i18n.format("PF1.Error.InsufficientCharges", {
          name: `${this.item.name}: ${this.action.name}`,
        })
      );
      return ERR_REQUIREMENT.INSUFFICIENT_CHARGES;
    }

    return 0;
  }

  /**
   * @returns {Promise<object>} The roll data object for this attack.
   */
  getRollData() {
    const rollData = foundry.utils.deepClone(this.shared.action.getRollData());
    const d20 = this.shared.dice;
    // TODO: Move this standard roll obfuscation to dialog handling
    rollData.d20 = d20 === pf1.dice.D20RollPF.standardRoll ? "" : d20;

    // Init values
    rollData.dcBonus ||= 0;
    rollData.chargeCost ||= 0;
    rollData.chargeCostBonus ||= 0;

    rollData.critMultBonus ||= 0;

    return rollData;
  }

  /**
   * Creates and renders an attack roll dialog, and returns a result.
   *
   * @returns {Promise<ItemAttack_Dialog_Result|null>}
   */
  createAttackDialog() {
    const dialog = new pf1.applications.AttackDialog(this);
    return dialog.show();
  }

  /**
   * Alters roll (and shared) data based on user input during the attack's dialog.
   *
   * @param {object} formData - The attack dialog's form data
   * @returns {Promise}
   */
  alterRollData(formData = {}) {
    const useOptions = this.shared.useOptions;
    formData["power-attack"] ??= useOptions.powerAttack;
    formData["primary-attack"] ??= useOptions.primaryAttack;
    formData["cl-check"] ??= useOptions.clCheck ?? this.item?.system.clCheck === true;
    formData["measure-template"] ??= useOptions.measureTemplate;
    formData["haste-attack"] ??= useOptions.haste;
    formData["manyshot"] ??= useOptions.manyshot;
    formData["rapid-shot"] ??= useOptions.rapidShot;
    formData["damage-ability-multiplier"] ??= useOptions.abilityMult;
    formData.fullAttack ??= true;

    if (formData["d20"]) this.shared.rollData.d20 = formData["d20"];
    const atkBonus = formData["attack-bonus"];
    if (atkBonus) {
      this.shared.attackBonus.push(atkBonus);
    }
    const dmgBonus = formData["damage-bonus"];
    if (dmgBonus) {
      this.shared.damageBonus.push(dmgBonus);
    }

    if (formData.rollMode) this.shared.rollMode = formData.rollMode;

    // Point-Blank Shot
    if (formData["point-blank-shot"]) {
      this.shared.attackBonus.push(`1[${game.i18n.localize("PF1.PointBlankShot")}]`);
      this.shared.damageBonus.push(`1[${game.i18n.localize("PF1.PointBlankShot")}]`);
      this.shared.pointBlankShot = true;
    }

    this.shared.fullAttack = formData.fullAttack;

    // Many-shot
    if (this.shared.fullAttack && formData["manyshot"]) {
      this.shared.manyShot = true;
    }

    // Rapid Shot
    if (this.shared.fullAttack && formData["rapid-shot"]) {
      this.shared.attackBonus.push(`-2[${game.i18n.localize("PF1.RapidShot")}]`);
    }

    // Primary attack
    if (formData["primary-attack"] != null)
      foundry.utils.setProperty(this.shared.rollData, "action.naturalAttack.primaryAttack", formData["primary-attack"]);

    // Use measure template
    if (formData["measure-template"] != null) this.shared.useMeasureTemplate = formData["measure-template"];

    // Set held type
    const held = formData["held"] || this.shared.rollData.action.held || this.shared.rollData.item.held || "normal";
    this.shared.rollData.action.held = held;

    // Damage multiplier
    const abilityDamageMultOverride = formData["damage-ability-multiplier"];
    if (abilityDamageMultOverride != null) {
      this.shared.rollData.action.ability.damageMult = abilityDamageMultOverride;
    }

    // Power Attack
    if (formData["power-attack"]) {
      const basePowerAttackBonus = this.shared.rollData.action?.powerAttack?.damageBonus ?? 2;
      let powerAttackBonus = (1 + Math.floor(this.shared.rollData.attributes.bab.total / 4)) * basePowerAttackBonus;

      // Get multiplier
      const paMult = this.shared.action.getPowerAttackMult({ rollData: this.shared.rollData });

      // Apply multiplier
      powerAttackBonus = Math.floor(powerAttackBonus * paMult);

      // Get label
      const label = ["rwak", "twak", "rsak"].includes(this.action.data.actionType)
        ? game.i18n.localize("PF1.DeadlyAim")
        : game.i18n.localize("PF1.PowerAttack");

      // Get penalty
      const powerAttackPenalty = -(
        1 + Math.floor(foundry.utils.getProperty(this.shared.rollData, "attributes.bab.total") / 4)
      );

      // Add bonuses
      this.shared.rollData.powerAttackPenalty = powerAttackPenalty;
      this.shared.attackBonus.push(`${powerAttackPenalty}[${label}]`);
      this.shared.powerAttack = true;
      this.shared.rollData.powerAttackBonus = powerAttackBonus;
      this.shared.rollData.powerAttackPenalty = powerAttackPenalty;
    } else {
      this.shared.rollData.powerAttackBonus = 0;
      this.shared.rollData.powerAttackPenalty = 0;
    }

    // Conditionals
    const { conditional: conditionals } = foundry.utils.expandObject(formData);
    if (conditionals) {
      this.shared.conditionals = [];
      Object.entries(conditionals).forEach(([idx, value]) => {
        if (value) this.shared.conditionals.push(parseInt(idx));
      });
    }
    // Conditional defaults for fast-forwarding
    if (!this.shared.conditionals) {
      this.shared.conditionals = this.shared.action.data.conditionals?.reduce((arr, con, i) => {
        if (con.default) arr.push(i);
        return arr;
      }, []);
    }

    // Apply secondary attack penalties
    if (
      this.shared.rollData.item.subType === "natural" &&
      this.shared.rollData.action?.naturalAttack.primaryAttack === false
    ) {
      const attackBonus = this.shared.rollData.action.naturalAttack?.secondary?.attackBonus || "-5";
      let damageMult = this.shared.rollData.action.naturalAttack?.secondary?.damageMult ?? 0.5;
      // Allow dialog override to work
      if (abilityDamageMultOverride) damageMult = abilityDamageMultOverride;
      this.shared.attackBonus.push(`(${attackBonus})[${game.i18n.localize("PF1.SecondaryAttack")}]`);
      this.shared.rollData.action.ability.damageMult = damageMult;
    }

    // CL check enabled
    this.shared.casterLevelCheck = formData["cl-check"];

    // Concentration enabled
    this.shared.concentrationCheck = formData["concentration"];
  }

  /**
   * @typedef {object} ItemAttack_AttackData
   * @property {string} label - The attack's name
   * @property {number|string|undefined} [attackBonus] - An attack bonus specific to this attack
   * @property {number|string|undefined} [damageBonus] - A damage bonus specific to this attack
   * @property {string|null} [ammo] - The ID of the ammo item used
   */
  /**
   * Generates attacks for an item's action.
   *
   * @param {boolean} [forceFullAttack=false] - Generate full attack data, e.g. as base data for an {@link AttackDialog}
   * @returns {Promise<ItemAttack_AttackData[]> | ItemAttack_AttackData[]} The generated default attacks.
   */
  generateAttacks(forceFullAttack = false) {
    const rollData = this.shared.rollData;
    const action = this.action;
    const actor = this.actor;

    const useOptions = this.shared.useOptions;

    // Use either natural fullAttack state, or force generation of all attacks via override
    const full = forceFullAttack || this.shared.fullAttack;

    /** @type {Array<ActionUseAttack>} */
    const allAttacks = this.action
      .getAttacks({ full, rollData, conditionals: false, bonuses: false })
      .map((atk) => new ActionUseAttack(atk.label, atk.bonus));

    // Set default ammo usage
    const ammoType = this.action.ammoType;
    if (ammoType) {
      const ammoId = this.item.getFlag("pf1", "defaultAmmo");
      const ammos = this.getAmmo();
      if (ammoId && ammos.length) {
        const ammo = ammos.find((a) => a.id === ammoId);
        const quantity = ammo?.quantity || 0;
        const ammoCost = action.ammoCost;
        const abundant = ammo?.abundant || false;
        for (let a = 0; a < allAttacks.length; a++) {
          const atk = allAttacks[a];
          if (abundant || quantity >= (a + 1) * ammoCost) atk.ammo = ammo;
          else atk.ammo = null;
        }
      }
    }

    this.shared.attacks = allAttacks;

    return allAttacks;
  }

  async autoSelectAmmo() {
    const ammoType = this.shared.action.ammoType;
    if (!ammoType) return;

    const ammoCost = this.action.ammoCost;

    const ammoId = this.item.getFlag("pf1", "defaultAmmo");
    const item = this.item.actor?.items.get(ammoId);
    if (item && (item.system.quantity || 0) >= ammoCost) return;

    const ammo = this.actor.itemTypes.loot
      .filter(
        (i) =>
          i.subType === "ammo" &&
          i.system.extraType === ammoType &&
          i.system.quantity >= ammoCost &&
          i.system.identified !== false
      )
      .sort((a, b) => a.system.price - b.system.price);

    if (ammo.length == 0) return;

    await this.item.setFlag("pf1", "defaultAmmo", ammo[0].id);
  }

  /**
   * Fetch valid ammo items from actor.
   *
   * @returns {AttackAmmo}
   */
  getAmmo() {
    const actor = this.actor;
    const ammoCost = this.action.ammoCost;
    const ammo = actor.itemTypes.loot.filter((item) => this._filterAmmo(item, ammoCost));

    const defaultAmmo = this.action.item.getFlag("pf1", "defaultAmmo");

    return ammo.map((o) => {
      return {
        id: o.id,
        quantity: o.system.quantity || 0,
        abundant: o.system.abundant || false,
        data: o.toObject(),
        document: o,
        isDefault: defaultAmmo === o.id,
      };
    });
  }

  /**
   * Determine if item is valid for use as ammo.
   *
   * @internal
   * @param {Item} item - Item to filter
   * @param {number} ammoCost - Ammo usage per attack
   * @returns {boolean}
   */
  _filterAmmo(item, ammoCost = 1) {
    if (!(item.type === "loot" && item.subType === "ammo")) return false;
    if (item.system.quantity < ammoCost) return false;

    const ammoType = item.system.extraType;
    if (!ammoType) return true;

    return this.action.ammoType === ammoType;
  }

  /**
   * Subtracts ammo for this attack, updating relevant items with new quantities.
   *
   * @param {number} [value=1] - How much ammo to subtract.
   * @returns {Promise}
   */
  async subtractAmmo(value = 1) {
    if (!this.shared.action.ammoType) return;

    const actor = this.item.actor;

    const ammoUsage = {};
    for (const atk of this.shared.attacks) {
      if (atk.ammo) {
        const item = actor.items.get(atk.ammo.id);
        if (!item) continue;
        // Don't remove abundant ammunition
        if (item.system.abundant) continue;

        ammoUsage[atk.ammo.id] ??= 0;
        ammoUsage[atk.ammo.id] += value;
      }
    }

    this.shared.ammoUsage = ammoUsage;

    if (!foundry.utils.isEmpty(ammoUsage)) {
      const updateData = Object.entries(ammoUsage).reduce((cur, [ammoId, usage]) => {
        const quantity = this.item.actor.items.get(ammoId)?.system.quantity;
        const obj = {
          _id: ammoId,
          "system.quantity": quantity - usage,
        };

        cur.push(obj);
        return cur;
      }, []);

      return this.item.actor.updateEmbeddedDocuments("Item", updateData);
    }
  }

  /**
   * Update remaining ammo in {@link ChatAttack}s
   */
  updateAmmoUsage() {
    const actor = this.actor;
    const ammoCost = this.action.ammoCost;
    if (ammoCost <= 0) return;
    for (const atk of this.shared.attacks) {
      const ammoId = atk.ammo?.id;
      if (!ammoId) continue;
      const chatAtk = atk.chatAttack;
      const ammo = actor.items.get(ammoId)?.system.quantity || 0;
      chatAtk.ammo.remaining = ammo;
      chatAtk.ammo.quantity = ammoCost;
    }
  }

  async handleConditionals() {
    if (this.shared.conditionals) {
      const conditionalData = {};
      for (const i of this.shared.conditionals) {
        const conditional = this.shared.action.data.conditionals[i];
        const tag = pf1.utils.createTag(conditional.name);
        for (const [i, modifier] of conditional.modifiers.entries()) {
          // Adds a formula's result to rollData to allow referencing it.
          // Due to being its own roll, this will only correctly work for static formulae.
          const conditionalRoll = await RollPF.safeRoll(modifier.formula, this.shared.rollData);
          if (conditionalRoll.err) {
            ui.notifications.warn(
              game.i18n.format("PF1.Warning.ConditionalRoll", { number: i + 1, name: conditional.name })
            );
            // Skip modifier to avoid multiple errors from one non-evaluating entry
            continue;
          } else {
            conditionalData[[tag, i].join(".")] = conditionalRoll.total;
          }

          // Create a key string for the formula array
          const partString = `${modifier.target}.${modifier.subTarget}${
            modifier.critical ? "." + modifier.critical : ""
          }`;
          // Add formula in simple format
          if (["attack", "effect", "misc"].includes(modifier.target)) {
            const hasFlavor = /\[.*\]/.test(modifier.formula);
            const flavoredFormula = hasFlavor ? modifier.formula : `(${modifier.formula})[${conditional.name}]`;
            this.shared.conditionalPartsCommon[partString] = [
              ...(this.shared.conditionalPartsCommon[partString] ?? []),
              flavoredFormula,
            ];
          }
          // Add formula as array for damage
          else if (modifier.target === "damage") {
            this.shared.conditionalPartsCommon[partString] = [
              ...(this.shared.conditionalPartsCommon[partString] ?? []),
              [modifier.formula, modifier.damageType, false],
            ];
          }
          // Add formula to the size property
          else if (modifier.target === "size") {
            this.shared.rollData.size += conditionalRoll.total;
          } else if (modifier.target === "critMult") {
            this.shared.rollData.critMultBonus += conditionalRoll.total;
          }
        }
      }

      // Expand data into rollData to enable referencing in formulae
      this.shared.rollData.conditionals = foundry.utils.expandObject(conditionalData, 5);

      // Add specific pre-rolled rollData entries
      for (const target of ["effect.cl", "effect.dc", "misc.charges"]) {
        if (this.shared.conditionalPartsCommon[target] != null) {
          const formula = this.shared.conditionalPartsCommon[target].join("+");
          const roll = await RollPF.safeRoll(formula, this.shared.rollData, [target, formula]);
          switch (target) {
            case "effect.cl":
              this.shared.rollData.cl += roll.total;
              break;
            case "effect.dc":
              this.shared.rollData.dcBonus += roll.total;
              break;
            case "misc.charges":
              this.shared.rollData.chargeCostBonus += roll.total;
              break;
          }
        }
      }
    }
  }

  /**
   * Checks all requirements to make the attack. This is after the attack dialog's data has been parsed.
   *
   * @returns {Promise<number> | number} 0 if successful, otherwise one of the ERR_REQUIREMENT constants.
   */
  checkAttackRequirements() {
    let cost = this.shared.rollData.chargeCost;

    if (cost > 0) {
      const uses = this.item.charges;
      if (this.item.type === "spell") {
        if (this.item.spellbook?.spontaneous && !this.item.system.preparation?.value) {
          cost = Infinity;
        }
      }

      // Cancel usage on insufficient charges
      if (cost > uses) {
        ui.notifications.warn(game.i18n.format("PF1.Error.InsufficientCharges", { name: this.item.name }));
        return ERR_REQUIREMENT.INSUFFICIENT_CHARGES;
      }
    }

    // Only spells have variable max uses
    if (this.item?.type === "spell") {
      const maxUses = this.item.maxCharges;
      if (maxUses <= 0) {
        ui.notifications.warn(game.i18n.format("PF1.Error.InsufficientPreparation", { name: this.item.name }));
        return ERR_REQUIREMENT.INSUFFICIENT_CHARGES;
      }
    }

    return 0;
  }

  /**
   * Generates ChatAttack entries based off the attack type.
   */
  async generateChatAttacks() {
    // Normal attack(s)
    if (this.shared.action.hasAttack) await this.addAttacks();
    // Damage only
    else if (this.shared.action.hasDamage) await this.addDamage();
    // for effect notes only
    else await this.addEmptyAttack();

    const misfire = this.action.misfire ?? 0;

    // Fill in ammo use details
    this.shared.attacks.forEach((/** @type {ChatAttack}*/ attack) => {
      if (!attack.hasAmmo) return;
      /** @type {ChatAttack} */
      const atk = attack.chatAttack;
      if (atk) atk.setAmmo(attack.ammo.id);
      // Mark misfire
      if (atk.ammo) {
        const d20 = atk.attack?.d20?.total;
        atk.ammo.misfire = d20 <= misfire;
      }
    });

    // Add save info
    this.shared.save = this.shared.action.data.save.type;
    this.shared.saveDC = this.shared.action.getDC(this.shared.rollData);

    // add notes after all attack info is generated
    await this.addEffectNotes();
    await this.addFootnotes();
  }

  /**
   * Determines conditional parts used in a specific attack.
   *
   * @param {object} atk - The attack used.
   * @param {number} [index=0] - The index of the attack, in order of enabled attacks.
   * @returns {object} The conditional parts used.
   */
  _getConditionalParts(atk, { index = 0 }) {
    const result = {};

    const conditionalTemplates = {
      "attack.normal": "attack.;id;.normal",
      "attack.crit": "attack.;id;.crit",
      "damage.normal": "damage.;id;.normal",
      "damage.crit": "damage.;id;.crit",
      "damage.nonCrit": "damage.;id;.nonCrit",
    };
    const addPart = (id) => {
      for (const [templateKey, templateStr] of Object.entries(conditionalTemplates)) {
        if (!result[templateKey]) result[templateKey] = [];

        const parsedStr = templateStr.replace(";id;", id);
        result[templateKey].push(...(this.shared.conditionalPartsCommon[parsedStr] ?? []));
      }
    };

    addPart(`attack_${index}`);
    addPart("allAttack");
    addPart("allDamage");

    if (atk.type === "rapid-shot") {
      addPart("rapidShotAttack");
      addPart("rapidShotDamage");
    } else if (atk.type === "haste-attack") {
      addPart("hasteAttack");
      addPart("hasteDamage");
    }

    return result;
  }

  /**
   * Adds ChatAttack entries to an attack's shared context.
   */
  async addAttacks() {
    const rollData = this.shared.rollData;

    for (let a = 0; a < this.shared.attacks.length; a++) {
      const atk = this.shared.attacks[a];

      // Combine conditional modifiers for attack and damage
      const conditionalParts = this._getConditionalParts(atk, { index: a });

      rollData.attackCount = a;

      // Create attack object
      const attack = new ChatAttack(this.shared.action, {
        label: atk.label,
        rollData,
        targets: game.user.targets,
        actionUse: this,
      });

      if (atk.type !== "manyshot") {
        // Add attack roll
        await attack.addAttack({
          extraParts: [...this.shared.attackBonus, atk.attackBonus],
          conditionalParts,
        });
      }

      // Add damage
      if (this.shared.action.hasDamage) {
        const extraParts = foundry.utils.deepClone(this.shared.damageBonus);
        const nonCritParts = [];
        const critParts = [];

        // Add power attack bonus
        if (rollData.powerAttackBonus > 0) {
          // Get label
          const label = ["rwak", "twak", "rsak"].includes(this.shared.action.data.actionType)
            ? game.i18n.localize("PF1.DeadlyAim")
            : game.i18n.localize("PF1.PowerAttack");

          const powerAttackBonus = rollData.powerAttackBonus;
          const powerAttackCritBonus = powerAttackBonus * (rollData.action?.powerAttack?.critMultiplier ?? 1);
          nonCritParts.push(`${powerAttackBonus}[${label}]`);
          critParts.push(`${powerAttackCritBonus}[${label}]`);
        }

        // Add damage
        let flavor = null;
        if (atk.type === "manyshot") flavor = game.i18n.localize("PF1.Manyshot");
        await attack.addDamage({
          flavor,
          extraParts: [...extraParts, ...nonCritParts],
          critical: false,
          conditionalParts,
        });

        // Add critical hit damage
        if (attack.hasCritConfirm) {
          await attack.addDamage({ extraParts: [...extraParts, ...critParts], critical: true, conditionalParts });
        }
      }

      // Add to list
      this.shared.chatAttacks.push(attack);

      // Add a reference to the attack that created this chat attack
      atk.chatAttack = attack;
    }

    // Cleanup rollData
    delete rollData.attackCount;
  }

  /**
   * Adds a ChatAttack entry for damage to an attack's shared context.
   */
  async addDamage() {
    // Set conditional modifiers
    this.shared.conditionalParts = {
      "damage.normal": this.shared.conditionalPartsCommon["damage.allDamage.normal"] ?? [],
    };

    const attack = new ChatAttack(this.shared.action, {
      rollData: this.shared.rollData,
      primaryAttack: this.shared.primaryAttack,
      actionUse: this,
    });
    // Add damage
    await attack.addDamage({
      extraParts: foundry.utils.deepClone(this.shared.damageBonus),
      critical: false,
      conditionalParts: this.shared.conditionalParts,
    });

    // Add to list
    this.shared.chatAttacks.push(attack);
  }

  async addFootnotes() {
    if (!this.item) return;

    const type = this.action.data.actionType;
    const typeMap = {
      rsak: ["ranged", "rangedSpell"],
      rwak: ["ranged", "rangedWeapon"],
      twak: ["ranged", "thrownWeapon", "rangedWeapon"],
      rcman: ["ranged"],
      mwak: ["melee", "meleeWeapon"],
      msak: ["melee", "meleeSpell"],
      mcman: ["melee"],
    };

    const isAttack = this.action.hasAttack ?? false;

    const notes = [];
    // Add actor notes for attacks
    if (this.actor && isAttack) {
      notes.push(...this.actor.getContextNotesParsed("attacks.attack"));
      typeMap[type]?.forEach((subTarget) => notes.push(...this.actor.getContextNotesParsed(`attacks.${subTarget}`)));
    }
    // Add item notes
    if (this.item?.system.attackNotes) {
      notes.push(...this.item.system.attackNotes);
    }
    // Add action notes
    if (this.action.data.attackNotes) {
      notes.push(...this.action.data.attackNotes);
    }

    // Add CMB notes
    if (this.action.isCombatManeuver) {
      notes.push(...(this.item?.actor?.getContextNotesParsed("misc.cmb") ?? []));
    }

    if (isAttack) {
      const hasCritConfirm = this.shared.attacks.some((atk) => !!atk.chatAttack?.hasCritConfirm);
      if (hasCritConfirm) notes.push(...(this.action.actor?.getContextNotesParsed("attacks.critical") ?? []));
    }

    this.shared.templateData.footnotes = notes;
  }

  async addEmptyAttack() {
    const attack = new ChatAttack(this.shared.action, {
      rollData: this.shared.rollData,
      primaryAttack: this.shared.primaryAttack,
      actionUse: this,
    });

    // Add to list
    this.shared.chatAttacks.push(attack);
  }

  /**
   * Add effect notes for each individual attack.
   */
  async addEffectNotes() {
    /** @type {ChatAttack[]} */
    const attacks = this.shared.chatAttacks;
    await Promise.all(attacks.filter((attack) => attack.type !== "manyshot").map((attack) => attack.addEffectNotes()));
  }

  /**
   * @typedef {object} Attack_MeasureTemplateResult
   * @property {boolean} result - Whether an area was selected.
   * @property {Function} [place] - Function to place the template, if an area was selected.
   * @property {Function} [delete] - Function to delete the template, if it has been placed.
   */
  /**
   * Prompts the user for an area, based on the attack's measure template.
   *
   * @returns {Promise.<Attack_MeasureTemplateResult>} Whether an area was selected.
   */
  async promptMeasureTemplate() {
    const mt = this.shared.action.data.measureTemplate;

    // Determine size
    let dist = RollPF.safeRollSync(mt.size, this.shared.rollData).total;
    // Apply system of units conversion
    dist = pf1.utils.convertDistance(dist)[0];

    // Create data object
    const templateOptions = {
      type: mt.type,
      distance: dist,
      flags: {
        pf1: {
          origin: {
            uuid: this.shared.item.uuid,
            action: this.shared.action.id,
          },
        },
      },
    };

    if (mt.color) {
      // Color transformation to avoid invalid colors provided by user from corrupting the template
      const c = Color.fromString(mt.color);
      if (Number.isFinite(Number(c))) templateOptions.color = c.toString();
    }
    if (mt.texture) templateOptions.texture = mt.texture;

    // Create template
    this.shared.template = null;
    const template = pf1.canvas.AbilityTemplate.fromData(templateOptions);
    let result;
    if (template) {
      const actorSheet = this.item.actor?.sheet;
      const sheetRendered = actorSheet?._element != null;
      if (sheetRendered) actorSheet.minimize();
      result = await template.drawPreview(this.shared.event);
      if (!result.result) {
        if (sheetRendered) actorSheet.maximize();
        return result;
      }
    }

    this.shared.template = await result.place();
    return result;
  }

  /**
   * Handles Dice So Nice integration.
   */
  async handleDiceSoNice() {
    if (!game.settings.get("pf1", "integration").diceSoNice) return;
    if (!game.dice3d?.isEnabled()) return;

    // Use try to make sure a chat card is rendered even if DsN fails
    try {
      // Define common visibility options for whole attack
      const chatData = {};
      ChatMessage.implementation.applyRollMode(chatData, this.shared.rollMode);

      const mergeRolls = game.settings.get("dice-so-nice", "enabledSimultaneousRolls");
      const skipRolls = game.settings.get("dice-so-nice", "immediatelyDisplayChatMessages");

      /**
       * Visually roll dice
       *
       * @async
       * @param {PoolTerm[]} pools - An array of PoolTerms to be rolled together
       * @returns {Promise} A Promise that is resolved when all rolls have been displayed
       */
      const showRoll = async (pools) => {
        const whisper = chatData.whisper?.length ? chatData.whisper : undefined; // DSN does not like empty array for whisper
        if (mergeRolls) {
          return Promise.all(
            pools.map((pool) => game.dice3d.showForRoll(pool, game.user, true, whisper, chatData.blind))
          );
        } else {
          for (const pool of pools) {
            await game.dice3d.showForRoll(pool, game.user, true, whisper, chatData.blind);
          }
        }
      };

      /** @type {PoolTerm[]} */
      const pools = [];

      for (const atk of this.shared.chatAttacks) {
        // Create PoolTerm for attack and damage rolls
        const attackPool = new PoolTerm();
        if (atk.attack) attackPool.rolls.push(atk.attack);
        attackPool.rolls.push(...(atk.damage?.rolls ?? []));

        // Create PoolTerm for crit confirmation and crit damage rolls
        const critPool = new PoolTerm();
        if (atk.chatAttack?.hasCritConfirm) critPool.rolls.push(atk.chatAttack.critConfirm);
        critPool.rolls.push(...(atk.critDamage?.rolls ?? []));

        // Add non-empty pools to the array of rolls to be displayed
        if (attackPool.rolls.length) pools.push(attackPool);
        if (critPool.rolls.length) pools.push(critPool);
      }

      if (pools.length) {
        // Chat card is to be shown immediately
        if (skipRolls) showRoll(pools);
        // Wait for rolls to finish before showing the chat card
        else await showRoll(pools);
      }
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Adds an attack's chat card data to the shared object.
   */
  async getMessageData() {
    if (this.shared.chatAttacks.length === 0) return;

    // Create chat template data
    this.shared.templateData = {
      ...this.shared.templateData,
      name: this.item.name,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      rollMode: this.shared.rollMode,
      attacks: this.shared.chatAttacks.map((o) => o.finalize()),
    };

    const actor = this.item.actor,
      token = this.token ?? actor?.token;

    // Set chat data
    this.shared.chatData = {
      speaker: ChatMessage.implementation.getSpeaker({ actor, token, alias: token?.name }),
      rollMode: this.shared.rollMode,
    };

    // Set attack sound
    if (this.shared.action.data.soundEffect) this.shared.chatData.sound = this.shared.action.data.soundEffect;
    // Set dice sound if neither attack sound nor Dice so Nice are available
    else if (!game.settings.get("pf1", "integration").diceSoNice || !game.dice3d?.isEnabled())
      this.shared.chatData.sound = CONFIG.sounds.dice;

    // Get extra text
    const props = [];
    const extraText = await this.enrichNotes(this.shared.templateData.footnotes, "PF1.Footnotes", "footnotes");

    const itemChatData = await this.item.getChatData({
      actionId: this.shared.action.id,
      chatcard: true,
      rollData: this.shared.rollData,
    });

    // Get properties
    const properties = [...itemChatData.properties, ...this.addGenericPropertyLabels()];
    if (properties.length > 0) props.push({ header: game.i18n.localize("PF1.InfoShort"), value: properties });

    // Get combat properties
    if (game.combat) {
      const combatProps = this.addCombatPropertyLabels();

      if (combatProps.length > 0) {
        props.push({
          header: game.i18n.localize("PF1.CombatInfo_Header"),
          value: combatProps,
          css: "combat-properties",
        });
      }
    }

    // Add CL notes
    if (this.item.type === "spell" && actor) {
      const clNotes = actor.getContextNotesParsed(`spell.cl.${this.item.system.spellbook}`);

      if (clNotes.length) {
        props.push({
          header: game.i18n.localize("PF1.CLNotes"),
          value: clNotes,
        });
      }

      const school = this.item.system.school;
      if (school) {
        // Add DC School notes
        const dcSchoolNotes = actor.getContextNotesParsed(`dc.school.${school}`);
        if (dcSchoolNotes.length) {
          props.push({
            header: game.i18n.format("PF1.DCSchoolNotes", { school: pf1.config.spellSchools[school] }),
            value: dcSchoolNotes,
          });
        }
        // Add CL School notes
        const clSchoolNotes = actor.getContextNotesParsed(`cl.school.${school}`);
        if (clSchoolNotes.length) {
          props.push({
            header: game.i18n.format("PF1.CLSchoolNotes", { school: pf1.config.spellSchools[school] }),
            value: clSchoolNotes,
          });
        }
      }
    }

    // Parse template data
    const identified = Boolean(this.shared.rollData.item?.identified ?? true);
    const name = identified ? `${this.item.name} (${this.shared.action.name})` : this.item.getName(true);
    this.shared.templateData = {
      ...this.shared.templateData,
      tokenUuid: token?.uuid,
      actionId: this.shared.action?.id,
      extraText: extraText,
      identified: identified,
      name: name,
      description: identified ? itemChatData.identifiedDescription : itemChatData.unidentifiedDescription,
      actionDescription: itemChatData.actionDescription,
      properties: props,
      item: this.item.toObject(),
      actor,
      token,
      scene: canvas.scene?.id,
      hasSave: this.shared.action.hasSave,
      rollData: this.shared.rollData,
      save: {
        dc: this.shared.saveDC,
        type: this.shared.save,
        label: game.i18n.format("PF1.SavingThrowButtonLabel", {
          type: pf1.config.savingThrows[this.shared.save],
          dc: this.shared.saveDC.toString(),
        }),
        gmSensitiveLabel: game.i18n.format("PF1.SavingThrowButtonLabelGMSensitive", {
          save: pf1.config.savingThrows[this.shared.save],
        }),
      },
    };

    // Add range info
    {
      const range = this.shared.action.getRange({ type: "max", rollData: this.shared.rollData });
      if (range != null) {
        this.shared.templateData.range = range;
        const usystem = pf1.utils.getDistanceSystem();
        this.shared.templateData.rangeLabel = usystem === "metric" ? `${range} m` : `${range} ft.`;

        const rangeUnits = this.shared.action.data.range.units;
        if (["melee", "touch", "reach", "close", "medium", "long"].includes(rangeUnits)) {
          this.shared.templateData.rangeLabel = pf1.config.distanceUnits[rangeUnits];
        }
      }
    }

    // Add spell info
    if (this.item.type === "spell" && actor) {
      // Spell failure
      if (actor.spellFailure > 0 && this.item.system.components.somatic) {
        const spellbook = foundry.utils.getProperty(
          actor.system,
          `attributes.spells.spellbooks.${this.item.system.spellbook}`
        );
        if (spellbook && spellbook.arcaneSpellFailure) {
          const roll = RollPF.safeRoll("1d100");
          this.shared.templateData.spellFailure = roll.total;
          this.shared.templateData.spellFailureRoll = roll;
          this.shared.templateData.spellFailureSuccess = this.shared.templateData.spellFailure > actor.spellFailure;
        }
      }
      // Caster Level Check
      this.shared.templateData.casterLevelCheck = this.shared.casterLevelCheck;
      // Concentration check
      this.shared.templateData.concentrationCheck = this.shared.concentrationCheck;
    }

    // Generate metadata
    const metadata = this.generateChatMetadata();

    // Get target info
    if (!game.settings.get("pf1", "disableAttackCardTargets")) {
      this.shared.templateData.targets = this.shared.targets.map((t) => ({
        img: t.document.texture.src,
        actor: t.actor,
        token: t.document,
        uuid: t.document.uuid,
      }));
    }

    this.shared.chatData["flags.pf1.metadata"] = metadata;
    this.shared.chatData["flags.core.canPopout"] = true;
    if (!identified)
      this.shared.chatData["flags.pf1.identifiedInfo"] = {
        identified,
        name: this.item._source.name || this.item.name,
        description: itemChatData.identifiedDescription,
        actionName: this.shared.action.name,
        actionDescription: itemChatData.actionDescription,
      };
  }

  /**
   * Enrich notes
   *
   * @param {Array<string>} notes - Notes
   * @param {string} title - Notes section title
   * @param {string} css - CSS selectors
   * @returns {string} - Enriched HTML as text
   */
  async enrichNotes(notes, title, css) {
    if (notes.length === 0) return;

    const enrichOptions = {
      rollData: this.shared.rollData,
      relativeTo: this.actor,
    };

    const renderContext = {
      notes,
      css,
      title,
    };

    const content = await renderTemplate("systems/pf1/templates/chat/parts/item-notes.hbs", renderContext);

    return TextEditor.enrichHTML(content, enrichOptions);
  }

  /**
   * Adds generic property labels to an attack's chat card.
   *
   * @returns {string[]} The resulting property labels.
   */
  addGenericPropertyLabels() {
    const properties = [];

    // Add actual cost
    const cost = this.shared.totalChargeCost;
    if (cost && !this.item.system.atWill) {
      if (this.item.type === "spell" && this.item.useSpellPoints()) {
        properties.push(`${game.i18n.localize("PF1.SpellPointsCost")}: ${cost}`);
      } else {
        properties.push(`${game.i18n.localize("PF1.ChargeCost")}: ${cost}`);
      }
    }

    // Add conditions
    const conditions = Object.entries(this.actor.system.conditions ?? {})
      .filter(([_, enabled]) => enabled)
      .map(([id]) => pf1.registry.conditions.get(id))
      .filter((c) => c?.showInAction)
      .map((c) => c.name);

    // Special case
    // TODO: Move this configuration to conditions registry
    if (this.actor.statuses.has("deaf") && this.item.type === "spell") {
      // TODO: Check if someone modified the conditions to show anyway?
      conditions.push(pf1.registry.conditions.get("deaf").name);
    }

    if (conditions.length) properties.push(...conditions);

    // Add info for broken state
    if (this.shared.rollData.item.broken) {
      properties.push(game.i18n.localize("PF1.Broken"));
    }

    // Nonlethal
    if (this.action.data.nonlethal) properties.push(game.i18n.localize("PF1.Nonlethal"));

    // Splash
    if (this.action.data.splash) properties.push(game.i18n.localize("PF1.Splash"));

    if (this.action.data.touch) properties.push(game.i18n.localize("PF1.TouchAttackShort"));

    // Add info for material
    let materialKey = null;
    let materialAddons = null;
    const normalMaterialAction = this.action.data.material?.normal.value;
    const normalMaterialItem = this.item.system.material?.normal.value;
    const baseMaterialItem = this.item.system.material?.base?.value;
    const addonMaterialAction = this.action.data.material?.addon;
    const addonMaterialItem = this.item.system.material?.addon;

    // Check the action data first, then the normal material, then the base material
    if (normalMaterialAction && normalMaterialAction.length > 0) materialKey = normalMaterialAction;
    else if (normalMaterialItem && normalMaterialItem.length > 0) materialKey = normalMaterialItem;
    else materialKey = baseMaterialItem;

    if (materialKey) {
      properties.push(pf1.registry.materials.get(materialKey.toLowerCase())?.name ?? materialKey.capitalize());
    }

    // Check for addon materials; prefer action data, then item data
    if (addonMaterialAction && addonMaterialAction.length > 0) materialAddons = addonMaterialAction;
    else if (addonMaterialItem && addonMaterialItem.length > 0) materialAddons = addonMaterialItem;

    if (materialAddons) {
      const materialAddonNames = materialAddons
        .map((addon) => {
          if (!addon) return null;
          const addonName = pf1.registry.materials.get(addon.toLowerCase())?.name ?? addon.capitalize();
          return addonName;
        })
        .filter((addon) => !!addon);

      if (materialAddonNames.length > 0) properties.push(...materialAddonNames);
    }

    // Add info for alignments
    const actionAlignments = this.action.data.alignments;
    const itemAlignments = this.item.system.alignments ?? {};
    if (actionAlignments) {
      for (const alignment of Object.keys(actionAlignments)) {
        if (
          actionAlignments[alignment] || // The action alignment is true OR
          (actionAlignments[alignment] === null && // (The action alignment is indeterminate AND
            itemAlignments[alignment])
        ) {
          // The item has the alignment)
          properties.push(game.i18n.localize(`PF1.Alignments.${alignment[0]}`));
        }
      }
    } else {
      // Honestly, this should never happen. An action should always have an alignment now.
      for (const alignment of Object.keys(itemAlignments)) {
        if (itemAlignments[alignment]) {
          properties.push(game.i18n.localize(`PF1.Alignments.${alignment[0]}`));
        }
      }
    }

    // Add info for Power Attack to melee, Deadly Aim to ranged attacks
    if (this.shared.powerAttack) {
      switch (this.action.data.actionType) {
        case "rwak":
        case "twak":
          properties.push(game.i18n.localize("PF1.DeadlyAim"));
          break;
        case "mwak":
          properties.push(game.i18n.localize("PF1.PowerAttack"));
          break;
      }
    }

    // Add info for Point-Blank shot
    if (this.shared.pointBlankShot) properties.push(game.i18n.localize("PF1.PointBlankShot"));

    // Add info for Rapid Shot
    if (this.shared.attacks.find((o) => o.id === "rapid-shot")) properties.push(game.i18n.localize("PF1.RapidShot"));

    if (this.shared.manyShot) properties.push(game.i18n.localize("PF1.Manyshot"));

    // Add Armor Check Penalty's application to attack rolls info
    if (this.item.hasAttack && this.shared.rollData.attributes?.acp?.attackPenalty > 0)
      properties.push(game.i18n.localize("PF1.ArmorCheckPenalty"));

    // Add conditionals info
    if (this.shared.conditionals?.length) {
      this.shared.conditionals.forEach((c) => {
        properties.push(this.shared.action.data.conditionals[c].name);
      });
    }

    // Add Wound Thresholds info
    if (this.shared.rollData.attributes?.woundThresholds?.level > 0)
      properties.push(pf1.config.woundThresholdConditions[this.shared.rollData.attributes.woundThresholds.level]);

    return properties;
  }

  /**
   * Adds combat property labels to an attack's chat card.
   *
   * @returns {string[]} The resulting property labels.
   */
  addCombatPropertyLabels() {
    const properties = [];

    // Add round info
    properties.push(game.i18n.format("PF1.CombatInfo_Round", { round: game.combat.round }));

    return properties;
  }

  /**
   * Generates metadata for this attack for the chat card to store.
   *
   * @returns {object} The resulting metadata object.
   */
  generateChatMetadata() {
    const metadata = {
      actor: this.actor.uuid,
      item: this.item.id,
      action: this.action.id,
      combat: undefined,
      template: this.shared.template?.uuid ?? null,
      rolls: {
        attacks: [],
      },
      targets: this.shared.targets.map((t) => t.document.uuid),
      config: {
        critMult: this.shared.rollData.critMult,
      },
    };

    if (this.actor && game.combat?.combatants.some((c) => c.actor === this.actor)) {
      metadata.combat = game.combat.id;
    }

    // Add attack rolls
    for (let attackIndex = 0; attackIndex < this.shared.chatAttacks.length; attackIndex++) {
      const chatAttack = this.shared.chatAttacks[attackIndex];
      const attackRolls = { attack: null, damage: [], critConfirm: null, critDamage: [] };
      // Add attack roll
      if (chatAttack.attack) attackRolls.attack = chatAttack.attack.toJSON();
      // Add damage rolls
      if (chatAttack.damage.rolls.length) {
        for (let damageIndex = 0; damageIndex < chatAttack.damage.rolls.length; damageIndex++) {
          const damageRoll = chatAttack.damage.rolls[damageIndex];
          attackRolls.damage[damageIndex] = damageRoll.toJSON();
        }
      }
      // Add critical confirmation roll
      if (chatAttack.critConfirm) attackRolls.critConfirm = chatAttack.critConfirm.toJSON();
      // Add critical damage rolls
      if (chatAttack.critDamage.rolls.length) {
        for (let damageIndex = 0; damageIndex < chatAttack.critDamage.rolls.length; damageIndex++) {
          const damageRoll = chatAttack.critDamage.rolls[damageIndex];
          attackRolls.critDamage[damageIndex] = damageRoll.toJSON();
        }
      }

      // Record used ammo ID and quantity
      if (chatAttack.ammo?.id) {
        // Quantity is included for future proofing for supporting attacks that consume more than 1.
        attackRolls.ammo = { id: chatAttack.ammo.id, quantity: 1, misfire: chatAttack.ammo.misfire ?? false };
      }

      metadata.rolls.attacks[attackIndex] = attackRolls;
    }

    // Add miscellaneous metadata
    if (this.shared.saveDC) metadata.save = { dc: this.shared.saveDC, type: this.shared.save };
    if (this.item.type === "spell") metadata.spell = { cl: this.shared.rollData.cl, sl: this.shared.rollData.sl };

    return metadata;
  }

  /**
   * Executes the item's script calls.
   *
   * @param {"use"|"postUse"} [category="use"] Script call category
   */
  async executeScriptCalls(category = "use") {
    const shared = this.shared;

    if (!("attackData" in shared)) {
      Object.defineProperty(shared, "attackData", {
        get: () => {
          foundry.utils.logCompatibilityWarning(
            "shared.attackData is deprecated in favor of directly accessing shared",
            {
              since: "PF1 v10",
              until: "PF1 v12",
            }
          );
          return shared;
        },
      });
    }

    const rv = await this.item.executeScriptCalls(category, {}, shared);

    if (category === "use") this.shared.scriptData = rv;
  }

  /**
   * Posts the attack's chat card.
   *
   * @returns {Promise<ChatMessage | SharedActionData | { descriptionOnly: boolean }> }
   */
  async postMessage() {
    // Old hook data + callAll
    const hookData = {
      ev: this.shared.event,
      skipDialog: this.shared.skipDialog,
      chatData: this.shared.chatData,
      templateData: this.shared.templateData,
      shared: this.shared,
    };

    this.shared.chatTemplate ||= "systems/pf1/templates/chat/attack-roll.hbs";
    this.shared.templateData.damageTypes = pf1.registry.damageTypes.toObject();
    if (Hooks.call("pf1PreDisplayActionUse", this) === false) return;

    // Show chat message
    let result;
    if (this.shared.chatMessage && this.shared.scriptData.hideChat !== true) {
      const enrichOptions = {
        rollData: this.shared.rollData,
        secrets: this.isOwner,
        relativeTo: this.actor,
      };

      const content = await renderTemplate(this.shared.chatTemplate, this.shared.templateData);
      this.shared.chatData.content = await TextEditor.enrichHTML(content, enrichOptions);

      const hiddenData = this.shared.chatData["flags.pf1.identifiedInfo"];
      if (hiddenData?.description) {
        hiddenData.description = await TextEditor.enrichHTML(hiddenData.description, enrichOptions);
      }
      if (hiddenData?.actionDescription) {
        hiddenData.actionDescription = await TextEditor.enrichHTML(hiddenData.actionDescription, enrichOptions);
      }

      // Apply roll mode
      this.shared.chatData.rollMode ??= game.settings.get("core", "rollMode");
      ChatMessage.implementation.applyRollMode(this.shared.chatData, this.shared.chatData.rollMode);

      result = await ChatMessage.implementation.create(this.shared.chatData);

      this.shared.message = result;
    } else result = this.shared;

    return result;
  }

  /**
   * Collect valid targets.
   */
  async getTargets() {
    // Get targets from template, and if no template is present, from explicitly targeted tokens list
    /** @type {MeasuredTemplatePF|null} */
    const template = this.shared.template?.object;
    let targets = template ? await template.getTokensWithin() : null;
    targets ??= Array.from(game.user.targets);
    // Ignore defeated and secret tokens
    this.shared.targets = targets.filter((t) => t.combatant?.isDefeated !== true);
  }

  /**
   * Armor as DR defense DC determination.
   *
   * @remarks
   * - Does not account for critical feats.
   * - Does not account for size difference between target and attacker.
   *
   * @param attack
   * @returns {RollPF} - Defense DC
   */
  getDefenseDC(attack) {
    const parts = this._getDefenseDCParts(attack);
    return RollPF.safeRollSync(parts.join(" + "));
  }

  _getDefenseDCParts(attack) {
    const parts = [];

    // Determine check
    const check = attack.d20.total;
    parts.push(`${check}[${game.i18n.localize("PF1.Rolls.Check.Label")}]`);

    // Locate used BAB (accounts for overrides)
    const babIdent = game.i18n.localize("PF1.BAB");
    const bab = attack.terms.find((t) => t.flavor === babIdent)?.number ?? 0;
    parts.push(`${Math.floor(bab / 2)}[${game.i18n.localize("PF1.HalfBAB")}]`);

    return parts;
  }

  async prepareChargeCost() {
    const rollData = this.shared.rollData;

    // Determine charge cost
    const baseCostRoll = await this.shared.action.getChargeCost({ rollData });
    const baseCost = baseCostRoll?.total || 0;

    // Bonus cost, e.g. from a conditional modifier
    const bonusCost = this.shared.rollData.chargeCostBonus ?? 0;

    let cost = baseCost + bonusCost;

    // Override cost
    if (this.shared.cost !== null) cost = this.shared.cost;

    // Save chargeCost as rollData entry for anything else
    this.shared.rollData.chargeCost = cost;
  }

  /**
   * Process everything
   *
   * @param {object} [options] - Additional options
   * @param {boolean} [options.skipDialog=false] - Skip dialog
   * @returns {Promise<ChatMessage|SharedActionData|void>}
   */
  async process({ skipDialog = false } = {}) {
    const shared = this.shared;

    // Check requirements for item
    let reqErr = await this.checkRequirements();
    if (reqErr > 0) return { err: pf1.actionUse.ERR_REQUIREMENT, code: reqErr };

    await this.autoSelectAmmo();

    // Get new roll data
    shared.rollData = this.getRollData();

    // let modules modify the ActionUse before attacks are rolled
    Hooks.callAll("pf1CreateActionUse", this);

    // Generate default attacks
    shared.fullAttack = true;
    await this.generateAttacks(true);

    let form;
    // Show attack dialog, if appropriate
    if (!skipDialog) {
      form = await this.createAttackDialog();
      // Stop if result is not an object (i.e. when closed is clicked on the dialog)
      if (!form) return;
    }

    // Save form data in case modules want to reference it later
    this.formData = form ?? {};

    // Alter roll data
    await this.alterRollData(form);

    // Filter out attacks without ammo usage (out of ammo)
    if (shared.action.ammoType) {
      shared.attacks = shared.attacks.filter((o) => o.hasAmmo);
      if (shared.attacks.length === 0) {
        ui.notifications.error(game.i18n.localize("PF1.AmmoDepleted"));
        return;
      }
    }

    // Limit attacks to 1 if not full rounding
    if (!shared.fullAttack) shared.attacks = shared.attacks.slice(0, 1);
    // Handle conditionals
    await this.handleConditionals();

    // Prepare charge cost
    await this.prepareChargeCost();

    // Filter out attacks without charge usage (out of charges)
    if (shared.rollData.chargeCost != 0 && this.shared.action.data.uses?.perAttack) {
      const cost = shared.rollData.chargeCost;
      const charges = shared.item.charges;

      shared.attacks.forEach((atk, index) => {
        if (charges >= (index + 1) * cost) atk.chargeCost = cost;
        else atk.chargeCost = null;
      });

      shared.attacks = shared.attacks.filter((o) => o.chargeCost !== null);
      if (shared.attacks.length === 0) {
        ui.notifications.error(game.i18n.localize("PF1.ChargesDepleted"));
        return;
      }
    }

    // Check attack requirements, post-dialog
    reqErr = await this.checkAttackRequirements();
    if (reqErr > 0) return { err: pf1.actionUse.ERR_REQUIREMENT, code: reqErr };

    // Prompt measure template
    let measureResult;
    if (shared.useMeasureTemplate && canvas.scene) {
      measureResult = await this.promptMeasureTemplate();
      if (!measureResult.result) return;
    }

    await this.getTargets();

    // Generate chat attacks - leave this just before `pf1PreActionuse` hook call
    await this.generateChatAttacks();

    // Call itemUse hook and determine whether the item can be used based off that
    if (Hooks.call("pf1PreActionUse", this) === false) {
      await measureResult?.delete();
      return;
    }

    // Call script calls
    await this.executeScriptCalls();
    if (shared.scriptData?.reject) {
      await measureResult?.delete();
      return;
    }

    const premessage_promises = [];
    // Handle Dice So Nice
    premessage_promises.push(this.handleDiceSoNice());

    // Subtract uses
    const ammoCost = this.action.ammoCost;
    if (ammoCost != 0) premessage_promises.push(this.subtractAmmo(ammoCost));

    let totalCost = shared.rollData?.chargeCost;
    if (this.action.data.uses.perAttack) {
      totalCost = this.shared.attacks.reduce((total, atk) => total + atk.chargeCost, 0);
    }
    if (totalCost != 0) {
      shared.totalChargeCost = totalCost;
      premessage_promises.push(this.item.addCharges(-totalCost));
    }

    if (shared.action.isSelfCharged)
      premessage_promises.push(shared.action.update({ "uses.self.value": shared.action.data.uses.self.value - 1 }));

    await Promise.all(premessage_promises);

    // Update remaining ammo for chat message display
    this.updateAmmoUsage();

    // Retrieve message data
    await this.getMessageData();

    // Post message
    let result = Promise.resolve(null);
    if (shared.scriptData?.hideChat !== true) {
      result = this.postMessage();
    }

    // Deselect targets
    if (game.settings.get("pf1", "clearTargetsAfterAttack") && game.user.targets.size) {
      game.user.updateTokenTargets([]);
      // Above does not communicate targets to other users, so..
      game.user.broadcastActivity({ targets: [] });
    }

    // Wait for chat message to be created before continuing
    await result;

    // Call post-use script calls
    await this.executeScriptCalls("postUse");

    Hooks.callAll("pf1PostActionUse", this, this.shared.message ?? null);

    return result;
  }
}

export class ActionUseAttack {
  /** @type {string|null} */
  type;

  /** @type {string} */
  label;

  /** @type {string} */
  attackBonus;

  /** @type {boolean} */
  abstract;

  /** @type {AttackAmmo|null} */
  ammo = null;

  /** @type {number} */
  chargeCost = null;

  /** @type {ChatAttack} */
  chatAttack = null;

  /** @type {boolean} */
  get hasAmmo() {
    return !!this.ammo;
  }

  constructor(label, bonus = "", ammo = null, { abstract = false, type = null } = {}) {
    this.label = label;
    this.attackBonus = bonus;
    this.ammo = ammo;
    this.abstract = abstract ?? false;
    this.type = type;
  }
}

/**
 * @typedef {object} ItemAttack_Dialog_Result
 * @property {boolean} fullAttack - Whether it's a full attack (true) or a single attack (false)
 * @property {JQuery} html - The html containing user input and selections.
 */

/**
 * @typedef {object} AttackAmmo
 * @property {string} id - Ammo item ID
 * @property {number} quantity - Quantity of ammo
 * @property {boolean} abundant - Is abundant?
 * @property {object} data - Ammo document data
 * @property {Item} document - Ammo document
 * @property {boolean} isDefault - Is this default ammo for the item?
 */
