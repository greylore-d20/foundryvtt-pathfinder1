import { createTag, convertDistance } from "@utils";
import { ChatAttack } from "./chat-attack.mjs";
import { createCustomChatMessage } from "@utils/chat.mjs";
import { RollPF } from "../dice/roll.mjs";
import { getDistanceSystem } from "@utils";

// Documentation/type imports
/** @typedef {import("@item/item-pf.mjs").SharedActionData} SharedActionData */
/** @typedef {import("@item/item-pf.mjs").ItemPF} ItemPF */
/** @typedef {import("@actor/actor-pf.mjs").ActorPF} ActorPF */
/** @typedef {import("@component/action.mjs").ItemAction} ItemAction */

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
  }

  /**
   * @returns {Promise<number>} - 0 when successful, otherwise one of the ERR_REQUIREMENT constants.
   */
  checkRequirements() {
    const actor = this.item.actor;
    if (actor && !actor.isOwner) {
      ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: actor.name }));
      return ERR_REQUIREMENT.NO_ACTOR_PERM;
    }

    if (this.item.type === "feat" && this.item.system.disabled) {
      ui.notifications.warn(game.i18n.localize("PF1.ErrorFeatDisabled"));
      return ERR_REQUIREMENT.DISABLED;
    }

    const itemQuantity = this.item.system.quantity;
    if (itemQuantity !== undefined && itemQuantity <= 0) {
      ui.notifications.warn(game.i18n.localize("PF1.ErrorNoQuantity"));
      return ERR_REQUIREMENT.INSUFFICIENT_QUANTITY;
    }

    if (this.action.isSelfCharged && this.action.data.uses.self?.value < 1) {
      ui.notifications.warn(
        game.i18n.format("PF1.ErrorInsufficientCharges", {
          name: `${this.item.name}: ${this.action.name}`,
        })
      );
      return ERR_REQUIREMENT.INSUFFICIENT_CHARGES;
    }

    return 0;
  }

  /**
   * @returns {object} The roll data object for this attack.
   */
  getRollData() {
    const rollData = deepClone(this.shared.action.getRollData());
    rollData.d20 = this.shared.dice !== "1d20" ? this.shared.dice : "";

    return rollData;
  }

  /**
   * Creates and renders an attack roll dialog, and returns a result.
   *
   * @returns {ItemAttack_Dialog_Result|boolean}
   */
  createAttackDialog() {
    const dialog = new pf1.applications.AttackDialog(this.shared.action, this.shared.rollData, this.shared);
    return dialog.show();
  }

  /**
   * Alters roll (and shared) data based on user input during the attack's dialog.
   *
   * @param {JQuery | object} form - The attack dialog's jQuery form data or FormData object
   */
  alterRollData(form = {}) {
    let formData;
    if (form instanceof jQuery) formData = new FormDataExtended(form[0].querySelector("form")).object;
    else formData = form;
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
      setProperty(this.shared.rollData, "action.naturalAttack.primaryAttack", formData["primary-attack"]);

    // Use measure template
    if (formData["measure-template"] != null) this.shared.useMeasureTemplate = formData["measure-template"];

    // Set held type
    const held = formData["held"] || this.shared.rollData.action.held || this.shared.rollData.item.held || "normal";
    this.shared.rollData.item.held = held;

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
      let powerAttackMultiplier = this.shared.rollData.item?.powerAttack?.multiplier;
      if (!powerAttackMultiplier) {
        powerAttackMultiplier = 1;
        if (this.item.system.subType === "natural") {
          // Primary
          if (this.shared.rollData.action.naturalAttack?.primaryAttack) {
            // Primary attack gets +50% damage like with two-handing if ability score multiplier is 1.5x or higher
            if (this.shared.rollData.action.ability?.damageMult >= 1.5) {
              powerAttackMultiplier = 1.5;
            }
          }
          // Secondary
          else {
            powerAttackMultiplier = 0.5;
          }
        } else {
          if (held === "2h") powerAttackMultiplier = 1.5;
          else if (held === "oh") powerAttackMultiplier = 0.5;
        }
      } else {
        powerAttackMultiplier = parseFloat(powerAttackMultiplier);
      }

      // Apply multiplier
      powerAttackBonus = Math.floor(powerAttackBonus * powerAttackMultiplier);

      // Get label
      const label = ["rwak", "twak", "rsak"].includes(this.action.data.actionType)
        ? game.i18n.localize("PF1.DeadlyAim")
        : game.i18n.localize("PF1.PowerAttack");

      // Get penalty
      const powerAttackPenalty = -(1 + Math.floor(getProperty(this.shared.rollData, "attributes.bab.total") / 4));

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
    Object.keys(formData).forEach((f) => {
      const idx = f.match(/conditional\.(\d+)/)?.[1];
      if (idx && formData[f]) {
        if (!this.shared.conditionals) this.shared.conditionals = [parseInt(idx)];
        else this.shared.conditionals.push(parseInt(idx));
      }
    });

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

    // Conditional defaults for fast-forwarding
    if (!this.shared.conditionals && foundry.utils.isEmpty(formData)) {
      this.shared.conditionals = this.shared.action.data.conditionals?.reduce((arr, con, i) => {
        if (con.default) arr.push(i);
        return arr;
      }, []);
    }
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
    const action = rollData.action;

    /**
     * Counter for unnamed or other numbered attacks, to be incremented with each usage.
     * Starts at 1 to account for the base attack.
     */
    let unnamedAttackIndex = 1;

    const attackName = action.attackName || game.i18n.format("PF1.FormulaAttack", { 0: unnamedAttackIndex });
    // Use either natural fullAttack state, or force generation of all attacks via override
    const fullAttack = forceFullAttack || this.shared.fullAttack;

    const allAttacks = fullAttack
      ? action.attackParts.reduce(
          (cur, r) => {
            cur.push({
              attackBonus: r[0],
              // Use defined label, or fall back to continuously numbered default attack name
              label: r[1] || game.i18n.format("PF1.FormulaAttack", { 0: (unnamedAttackIndex += 1) }),
            });
            return cur;
          },
          [{ attackBonus: "", label: attackName }]
        )
      : [{ attackBonus: "", label: attackName }];

    // Formulaic extra attacks
    if (fullAttack) {
      const exAtkCountFormula = action.formulaicAttacks?.count?.formula,
        exAtkCount = RollPF.safeRoll(exAtkCountFormula, rollData)?.total ?? 0,
        exAtkBonusFormula = action.formulaicAttacks?.bonus?.formula || "0";
      if (exAtkCount > 0) {
        try {
          for (let i = 0; i < exAtkCount; i++) {
            rollData.formulaicAttack = i + 1; // Add and update attack counter
            const bonus = RollPF.safeRoll(exAtkBonusFormula, rollData).total;
            delete rollData.formulaicAttack;
            allAttacks.push({
              attackBonus: `(${bonus})[${game.i18n.localize("PF1.Iterative")}]`,
              // If formulaic attacks have a non-default name, number them with their own counter; otherwise, continue unnamed attack numbering
              label: action.formulaicAttacks.label
                ? action.formulaicAttacks.label.replace("{0}", i + 1)
                : game.i18n.format("PF1.FormulaAttack", { 0: (unnamedAttackIndex += 1) }),
            });
          }
        } catch (err) {
          console.error(err);
        }
      }
    }

    // Set ammo usage
    const ammoType = this.action.ammoType;
    if (ammoType) {
      const ammoId = this.item.getFlag("pf1", "defaultAmmo");
      const item = this.item.actor?.items.get(ammoId);
      const quantity = item?.system.quantity ?? 0;
      const abundant = item?.flags.pf1?.abundant ?? false;
      for (let a = 0; a < allAttacks.length; a++) {
        const atk = allAttacks[a];
        if (abundant || quantity >= a + 1) atk.ammo = ammoId;
        else atk.ammo = null;
      }
    }

    return allAttacks;
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
        const item = actor.items.get(atk.ammo);
        // Don't remove abundant ammunition
        if (item.flags?.pf1?.abundant) continue;

        ammoUsage[atk.ammo] ??= 0;
        ammoUsage[atk.ammo]++;
      }
    }

    this.shared.ammoUsage = ammoUsage;

    if (!foundry.utils.isEmpty(ammoUsage)) {
      const updateData = Object.entries(ammoUsage).reduce((cur, o) => {
        const currentValue = this.item.actor.items.get(o[0]).system.quantity;
        const obj = {
          _id: o[0],
          "system.quantity": currentValue - o[1],
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
    for (const atk of this.shared.attacks) {
      if (!atk.ammo) continue;
      const attack = atk.chatAttack;
      const ammo = actor.items.get(atk.ammo)?.system.quantity ?? 0;
      attack.ammo.remaining = ammo;
    }
  }

  handleConditionals() {
    if (this.shared.conditionals) {
      const conditionalData = {};
      for (const i of this.shared.conditionals) {
        const conditional = this.shared.action.data.conditionals[i];
        const tag = createTag(conditional.name);
        for (const [i, modifier] of conditional.modifiers.entries()) {
          // Adds a formula's result to rollData to allow referencing it.
          // Due to being its own roll, this will only correctly work for static formulae.
          const conditionalRoll = RollPF.safeRoll(modifier.formula, this.shared.rollData);
          if (conditionalRoll.err) {
            ui.notifications.warn(
              game.i18n.format("PF1.WarningConditionalRoll", { number: i + 1, name: conditional.name })
            );
            // Skip modifier to avoid multiple errors from one non-evaluating entry
            continue;
          } else conditionalData[[tag, i].join(".")] = RollPF.safeRoll(modifier.formula, this.shared.rollData).total;

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
          }
        }
      }
      // Expand data into rollData to enable referencing in formulae
      this.shared.rollData.conditionals = expandObject(conditionalData, 5);

      // Add specific pre-rolled rollData entries
      for (const target of ["effect.cl", "effect.dc", "misc.charges"]) {
        if (this.shared.conditionalPartsCommon[target] != null) {
          const formula = this.shared.conditionalPartsCommon[target].join("+");
          const roll = RollPF.safeRoll(formula, this.shared.rollData, [target, formula]).total;
          switch (target) {
            case "effect.cl":
              this.shared.rollData.cl += roll;
              break;
            case "effect.dc":
              this.shared.rollData.dcBonus ||= 0;
              this.shared.rollData.dcBonus += roll;
              break;
            case "misc.charges":
              this.shared.rollData.chargeCostBonus ||= 0;
              this.shared.rollData.chargeCostBonus += roll;
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
    // Determine charge cost
    const baseCost = this.shared.action.getChargeCost({ rollData: this.shared.rollData });

    // Bonus cost, e.g. from a conditional modifier
    const bonusCost = this.shared.rollData["chargeCostBonus"] ?? 0;

    let cost = baseCost + bonusCost;

    // Save chargeCost as rollData entry for anything else
    this.shared.rollData.chargeCost = cost;

    if (cost != 0) {
      const uses = this.item.charges;
      if (this.item.type === "spell") {
        if (this.item.spellbook?.spontaneous && !this.item.system.preparation?.spontaneousPrepared) {
          cost = Infinity;
        }
      }

      // Cancel usage on insufficient charges
      if (cost > uses) {
        ui.notifications.warn(game.i18n.format("PF1.ErrorInsufficientCharges", { name: this.item.name }));
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
    // Effect notes only
    else await this.addEffectNotes();

    // Add attack cards
    this.shared.attacks.forEach((attack) => {
      if (!attack.ammo) return;
      /** @type {ChatAttack} */
      const atk = attack.chatAttack;
      if (atk) atk.setAmmo(attack.ammo);
    });

    // Add save info
    this.shared.save = this.shared.action.data.save.type;
    this.shared.saveDC = this.shared.action.getDC(this.shared.rollData);
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

    if (atk.id === "rapid-shot") {
      addPart("rapidShotAttack");
      addPart("rapidShotDamage");
    } else if (atk.id === "haste-attack") {
      addPart("hasteAttack");
      addPart("hasteDamage");
    }

    return result;
  }

  /**
   * Adds ChatAttack entries to an attack's shared context.
   */
  async addAttacks() {
    for (let a = 0; a < this.shared.attacks.length; a++) {
      const atk = this.shared.attacks[a];

      // Combine conditional modifiers for attack and damage
      const conditionalParts = this._getConditionalParts(atk, { index: a });

      this.shared.rollData.attackCount = a;

      // Create attack object
      const attack = new ChatAttack(this.shared.action, {
        label: atk.label,
        rollData: this.shared.rollData,
        targets: game.user.targets,
      });

      if (atk.id !== "manyshot") {
        // Add attack roll
        await attack.addAttack({
          extraParts: [...this.shared.attackBonus, atk.attackBonus],
          conditionalParts,
        });
      }

      // Add damage
      if (this.shared.action.hasDamage) {
        const extraParts = duplicate(this.shared.damageBonus);
        const nonCritParts = [];
        const critParts = [];

        // Add power attack bonus
        if (this.shared.rollData.powerAttackBonus > 0) {
          // Get label
          const label = ["rwak", "twak", "rsak"].includes(this.shared.action.data.actionType)
            ? game.i18n.localize("PF1.DeadlyAim")
            : game.i18n.localize("PF1.PowerAttack");

          const powerAttackBonus = this.shared.rollData.powerAttackBonus;
          const powerAttackCritBonus = powerAttackBonus * (this.shared.rollData.item?.powerAttack?.critMultiplier ?? 1);
          nonCritParts.push(`${powerAttackBonus}[${label}]`);
          critParts.push(`${powerAttackCritBonus}[${label}]`);
        }

        // Add damage
        let flavor = null;
        if (atk.id === "manyshot") flavor = game.i18n.localize("PF1.Manyshot");
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

      // Add attack notes
      if (a === 0) attack.addAttackNotes();

      // Add effect notes
      if (atk.id !== "manyshot") {
        await attack.addEffectNotes();
      }

      // Add to list
      this.shared.chatAttacks.push(attack);

      // Add a reference to the attack that created this chat attack
      atk.chatAttack = attack;
    }

    // Cleanup rollData
    delete this.shared.rollData.attackCount;
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
    });
    // Add damage
    await attack.addDamage({
      extraParts: duplicate(this.shared.damageBonus),
      critical: false,
      conditionalParts: this.shared.conditionalParts,
    });

    // Add effect notes
    await attack.addEffectNotes();

    // Add to list
    this.shared.chatAttacks.push(attack);
  }

  /**
   * Adds a ChatAttack entry for effect notes to an attack's shared context.
   */
  async addEffectNotes() {
    const attack = new ChatAttack(this.shared.action, {
      rollData: this.shared.rollData,
      primaryAttack: this.shared.primaryAttack,
    });

    // Add effect notes
    await attack.addEffectNotes();

    // Add to list
    this.shared.chatAttacks.push(attack);
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
    // Determine size
    let dist = this.shared.action.data.measureTemplate.size;
    if (typeof dist === "string") {
      dist = RollPF.safeRoll(this.shared.action.data.measureTemplate.size, this.shared.rollData).total;
    }
    dist = convertDistance(dist)[0];

    // Create data object
    const templateOptions = {
      type: this.shared.action.data.measureTemplate.type,
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

    if (this.shared.action.data.measureTemplate.overrideColor) {
      templateOptions.color = this.shared.action.data.measureTemplate.customColor;
    }
    if (this.shared.action.data.measureTemplate.overrideTexture) {
      templateOptions.texture = this.shared.action.data.measureTemplate.customTexture;
    }

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
        if (atk.hasCritConfirm) critPool.rolls.push(atk.critConfirm);
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
  getMessageData() {
    if (this.shared.chatAttacks.length === 0) return;

    // Create chat template data
    this.shared.templateData = {
      action: this.shared.action,
      name: this.item.name,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
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
    else if (game.dice3d == null || !game.dice3d.isEnabled()) this.shared.chatData.sound = CONFIG.sounds.dice;

    // Get extra text
    const props = [];
    let extraText = "";
    if (this.shared.templateData.attacks.length > 0) extraText = this.shared.templateData.attacks[0].attackNotesHTML;

    const itemChatData = this.item.getChatData(
      { rollData: this.shared.rollData },
      { actionId: this.shared.action.id, chatcard: true }
    );

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
    }

    // Parse template data
    const identified = Boolean(this.shared.rollData.item?.identified ?? true);
    const name = identified ? `${this.item.name} (${this.shared.action.name})` : this.item.getName(true);
    this.shared.templateData = mergeObject(
      this.shared.templateData,
      {
        tokenUuid: token ? token.document?.uuid ?? token.uuid : null,
        actionId: this.shared.action?.id,
        extraText: extraText,
        identified: identified,
        name: name,
        description: identified ? itemChatData.identifiedDescription : itemChatData.unidentifiedDescription,
        actionDescription: itemChatData.actionDescription,
        hasExtraText: extraText.length > 0,
        properties: props,
        hasProperties: props.length > 0,
        item: this.item.toObject(),
        actor,
        token,
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
      },
      { inplace: false }
    );

    // Add range info
    {
      const range = this.shared.action.getRange({ type: "max", rollData: this.shared.rollData });
      if (range != null) {
        this.shared.templateData.range = range;
        const usystem = getDistanceSystem();
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
        const spellbook = getProperty(actor.system, `attributes.spells.spellbooks.${this.item.system.spellbook}`);
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
      const targets = metadata.targets?.length
        ? metadata.targets.map((o) => canvas.tokens.get(o)).filter((o) => o != null)
        : [];
      if (targets.length) {
        this.shared.templateData.targets = targets.map((o) => {
          return {
            img: o.document.texture.src,
            actorData: o.actor?.toObject(false),
            tokenData: o.document.toObject(false),
            uuid: o.document.uuid,
          };
        });
      }
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
   * Adds generic property labels to an attack's chat card.
   *
   * @returns {string[]} The resulting property labels.
   */
  addGenericPropertyLabels() {
    const properties = [];

    // Add actual cost
    const cost = this.shared.rollData.chargeCost;
    if (cost && !this.item.system.atWill) {
      if (this.item.type === "spell" && this.item.useSpellPoints()) {
        properties.push(`${game.i18n.localize("PF1.SpellPointsCost")}: ${cost}`);
      } else {
        properties.push(`${game.i18n.localize("PF1.ChargeCost")}: ${cost}`);
      }
    }

    // Add info for broken state
    if (this.item.system.broken) {
      properties.push(game.i18n.localize("PF1.Broken"));
    }

    // Nonlethal
    if (this.action.data.nonlethal) properties.push(game.i18n.localize("PF1.Nonlethal"));

    if (this.action.data.touch) properties.push(game.i18n.localize("PF1.TouchAttackShort"));

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
      properties.push(
        game.i18n.localize(pf1.config.woundThresholdConditions[this.shared.rollData.attributes.woundThresholds.level])
      );

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
    const metadata = {};

    metadata.item = this.item.id;
    metadata.action = this.action.id;
    if (this.actor && game.combat?.combatants.some((c) => c.actor === this.actor)) {
      metadata.combat = game.combat.id;
    }
    metadata.template = this.shared.template ? this.shared.template.id : null;
    metadata.rolls = {
      attacks: [],
    };

    // Get template for later variables
    const template = this.shared.template;

    // Add targets
    if (template) {
      metadata.targets = template.object
        .getTokensWithin()
        .filter((t) => t.combatant?.isDefeated !== true)
        .map((o) => o.id);
    } else {
      metadata.targets = Array.from(game.user.targets).map((o) => o.id);
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
        attackRolls.ammo = { id: chatAttack.ammo.id, quantity: 1 };
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
   * @returns {object} The resulting data from the script calls.
   */
  async executeScriptCalls() {
    // Execute script call
    this.shared.scriptData = await this.item.executeScriptCalls("use", {
      attackData: this.shared,
    });
  }

  /**
   * Posts the attack's chat card.
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
    if (this.shared.chatAttacks.length > 0) {
      if (this.shared.chatMessage && this.shared.scriptData.hideChat !== true)
        result = await createCustomChatMessage(
          this.shared.chatTemplate,
          this.shared.templateData,
          this.shared.chatData
        );
      else result = this.shared;
    } else {
      if (this.shared.chatMessage && this.shared.scriptData.hideChat !== true) result = this.item.roll();
      else result = { descriptionOnly: true };
    }

    return result;
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

    // Get new roll data
    shared.rollData = this.getRollData();

    // Show attack dialog, if appropriate
    if (!skipDialog) {
      const result = await this.createAttackDialog();

      // Stop if result is a boolean (i.e. when closed is clicked on the dialog)
      if (typeof result !== "object") return;

      // Alter roll data
      shared.fullAttack = result.fullAttack;
      shared.attacks = result.attacks;
      await this.alterRollData(result.html);
    } else {
      shared.attacks = await this.generateAttacks();
      await this.alterRollData();
    }

    // Filter out attacks without ammo usage
    if (shared.action.ammoType) {
      shared.attacks = shared.attacks.filter((o) => o.ammo != null);
      if (shared.attacks.length === 0) {
        ui.notifications.error(game.i18n.localize("PF1.AmmoDepleted"));
        return;
      }
    }

    // Limit attacks to 1 if not full rounding
    if (!shared.fullAttack) shared.attacks = shared.attacks.slice(0, 1);
    // Handle conditionals
    await this.handleConditionals();

    // Check attack requirements, post-dialog
    reqErr = await this.checkAttackRequirements();
    if (reqErr > 0) return { err: pf1.actionUse.ERR_REQUIREMENT, code: reqErr };

    // Generate chat attacks
    await this.generateChatAttacks();

    // Prompt measure template
    let measureResult;
    if (shared.useMeasureTemplate && canvas.scene) {
      measureResult = await this.promptMeasureTemplate();
      if (!measureResult.result) return;
    }

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
    premessage_promises.push(this.subtractAmmo());

    if (shared.rollData.chargeCost < 0 || shared.rollData.chargeCost > 0)
      premessage_promises.push(this.addCharges(-shared.rollData.chargeCost));
    if (shared.action.isSelfCharged)
      premessage_promises.push(shared.action.update({ "uses.self.value": shared.action.data.uses.self.value - 1 }));

    await Promise.all(premessage_promises);

    // Update remaining ammo for chat message display
    this.updateAmmoUsage();

    // Retrieve message data
    this.getMessageData();

    // Post message
    let result;
    if (shared.scriptData?.hideChat !== true) {
      result = this.postMessage();
    }

    // Deselect targets
    if (game.settings.get("pf1", "clearTargetsAfterAttack") && game.user.targets.size) {
      game.user.updateTokenTargets([]);
      // Above does not communicate targets to other users, so..
      game.user.broadcastActivity({ targets: [] });
    }

    return result;
  }
}

/**
 * @typedef {object} ItemAttack_Dialog_Result
 * @property {boolean} fullAttack - Whether it's a full attack (true) or a single attack (false)
 * @property {JQuery} html - The html containing user input and selections.
 */
