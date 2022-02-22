import { createTag, convertDistance } from "../lib.js";
import { ChatAttack } from "../misc/chat-attack.js";
import { createCustomChatMessage } from "../chat.js";

export const ERR_REQUIREMENT = {
  NO_ACTOR_PERM: 1,
  DISABLED: 2,
  INSUFFUCIENT_QUANTITY: 3,
  INSUFFICIENT_CHARGES: 4,
  MISSING_AMMO: 5,
  INSUFFICIENT_AMMO: 6,
};

/**
 * @param {Object} shared - Shared data between attack functions.
 * @returns {number} - 0 when successful, otherwise one of the ERR_REQUIREMENT constants.
 */
export const checkRequirements = async function (shared) {
  const actor = this.parent;
  if (actor && !actor.isOwner) {
    const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(actor.name);
    console.warn(msg);
    ui.notifications.warn(msg);
    return ERR_REQUIREMENT.NO_ACTOR_PERM;
  }

  if (this.type === "feat" && this.data.data.disabled) {
    const msg = game.i18n.localize("PF1.ErrorFeatDisabled");
    console.warn(msg);
    ui.notifications.warn(msg);
    return ERR_REQUIREMENT.DISABLED;
  }

  const itemQuantity = getProperty(this.data, "data.quantity");
  if (itemQuantity != null && itemQuantity <= 0) {
    const msg = game.i18n.localize("PF1.ErrorNoQuantity");
    console.warn(msg);
    ui.notifications.warn(msg);
    return ERR_REQUIREMENT.INSUFFUCIENT_QUANTITY;
  }

  if (this.isCharged && this.charges < this.chargeCost) {
    const msg = game.i18n.localize("PF1.ErrorInsufficientCharges").format(this.name);
    console.warn(msg);
    ui.notifications.warn(msg);
    return ERR_REQUIREMENT.INSUFFICIENT_CHARGES;
  }

  // Check ammunition links
  shared.ammoLinks = await this.getLinkedItems("ammunition", true);
  for (const l of shared.ammoLinks) {
    if (!l.item) {
      const msg = game.i18n.localize("PF1.WarningMissingAmmunition");
      console.warn(msg);
      ui.notifications.warn(msg);
      return ERR_REQUIREMENT.MISSING_AMMO;
    }
    shared.ammoAvailable = Math.min(shared.ammoAvailable, l.item?.charges ?? 0);

    if (shared.ammoAvailable <= 0) {
      const msg = game.i18n.localize("PF1.WarningInsufficientAmmunition").format(l.item.name);
      console.warn(msg);
      ui.notifications.warn(msg);
      return ERR_REQUIREMENT.INSUFFICIENT_AMMO;
    }
  }

  return 0;
};

/**
 * @param {Object} shared - Shared data between attack functions.
 * @returns {Object} The roll data object for this attack.
 */
export const getRollData = function (shared) {
  const rollData = duplicate(this.getRollData());
  rollData.d20 = shared.dice !== "1d20" ? shared.dice : "";

  return rollData;
};

/**
 * @typedef {object} ItemAttack_Dialog_Result
 * @property {boolean} fullAttack - Whether it's a full attack (true) or a single attack (false)
 * @property {JQuery} html - The html containing user input and selections.
 */
/**
 * Creates and renders an attack roll dialog, and returns a result.
 *
 * @param {Object} shared - Shared data between attack functions.
 * @returns {ItemAttack_Dialog_Result|boolean}
 */
export const createAttackDialog = async function (shared) {
  const dialog = new game.pf1.applications.AttackDialog(this, shared.rollData);
  return dialog.show();
};

/**
 * Alters roll (and shared) data based on user input during the attack's dialog.
 *
 * @param {Object} shared - Shared data between attack functions.
 * @param {JQuery} form - The attack dialog's form data.
 */
export const alterRollData = function (shared, form) {
  const formData = new FormDataExtended(form[0].querySelector("form")).toObject();
  shared.rollData.d20 = formData["d20"];
  const atkBonus = formData["attack-bonus"];
  if (atkBonus) {
    shared.attackBonus.push(atkBonus);
  }
  const dmgBonus = formData["damage-bonus"];
  if (dmgBonus) {
    shared.damageBonus.push(dmgBonus);
  }
  shared.rollMode = formData["rollMode"];

  // Point-Blank Shot
  if (formData["point-blank-shot"]) {
    shared.attackBonus.push(`1[${game.i18n.localize("PF1.PointBlankShot")}]`);
    shared.damageBonus.push(`1[${game.i18n.localize("PF1.PointBlankShot")}]`);
    shared.pointBlankShot = true;
  }

  // Haste
  if (shared.fullAttack && formData["haste-attack"]) {
    shared.attacks.push({
      id: "haste",
      label: game.i18n.localize("PF1.Haste"),
    });
  }

  // Many-shot
  if (shared.fullAttack && formData["manyshot"]) {
    shared.attacks.push({
      id: "manyshot",
      label: game.i18n.localize("PF1.ManyShot"),
    });
  }

  // Rapid Shot
  if (shared.fullAttack && formData["rapid-shot"]) {
    shared.attacks.push({
      id: "rapidshot",
      label: game.i18n.localize("PF1.RapidShot"),
    });
    shared.attackBonus.push(`-2[${game.i18n.localize("PF1.RapidShot")}]`);
  }

  // Primary attack
  shared.rollData.item.primaryAttack = formData["primary-attack"];

  // Use measure template
  shared.useMeasureTemplate = formData["measure-template"];

  // Power Attack
  if (formData["power-attack"]) {
    let powerAttackBonus = (1 + Math.floor(getProperty(shared.rollData, "attributes.bab.total") / 4)) * 2;
    if (this.data.data.attackType === "natural") {
      if (shared.rollData.item?.primaryAttack && shared.rollData.item.ability.damageMult >= 1.5)
        powerAttackBonus *= 1.5;
      else if (!shared.rollData.item?.primaryAttack) powerAttackBonus *= 0.5;
    } else {
      if (shared.rollData?.item?.held === "2h") powerAttackBonus *= 1.5;
      else if (getProperty(shared.rollData, "item.held") === "oh") powerAttackBonus *= 0.5;
    }
    const label = ["rwak", "rsak"].includes(this.data.data.actionType)
      ? game.i18n.localize("PF1.DeadlyAim")
      : game.i18n.localize("PF1.PowerAttack");
    shared.damageBonus.push(`${powerAttackBonus}[${label}]`);
    const powerAttackPenalty = -(1 + Math.floor(getProperty(shared.rollData, "attributes.bab.total") / 4));
    shared.rollData.powerAttackPenalty = powerAttackPenalty;
    shared.attackBonus.push(`${powerAttackPenalty}[${label}]`);
    shared.powerAttack = true;
  }

  // Conditionals
  const elem = form.find(".conditional");
  if (elem.length > 0) {
    shared.conditionals = elem
      .map(function () {
        if ($(this).prop("checked")) return Number($(this).prop("name").split(".")[1]);
      })
      .get();
  }

  // Damage multiplier
  shared.rollData.item.ability.damageMult = form.find(`[name="damage-ability-multiplier"]`).val() ?? 1;

  // CL check enabled
  shared.casterLevelCheck = formData["cl-check"];

  // Concentration enabled
  shared.concentrationCheck = formData["concentration"];

  // Conditional defaults for fast-forwarding
  if (shared.conditionals === undefined) {
    shared.conditionals = this.data.data.conditionals?.reduce((arr, con, i) => {
      if (con.default) arr.push(i);
      return arr;
    }, []);
  }
};

/**
 * @typedef {Object} ItemAttack_AttackData
 * @property {string} label - The attack's name
 * @property {number|string|undefined} [attackBonus] - An attack bonus specific to this attack
 * @property {number|string|undefined} [damageBonus] - A damage bonus specific to this attack
 */
/**
 * Generates attacks for an item's action.
 *
 * @param {Object} shared - Shared data between attack functions.
 * @returns {ItemAttack_AttackData[]} The generated default attacks.
 */
export const generateAttacks = function (shared) {
  const attackName = this.data.data.attackName;
  const allAttacks = shared.fullAttack
    ? this.data.data.attackParts.reduce(
        (cur, r) => {
          cur.push({ attackBonus: r[0], label: r[1] });
          return cur;
        },
        [{ attackBonus: "", label: attackName ? attackName : `${game.i18n.localize("PF1.Attack")}` }]
      )
    : [{ attackBonus: "", label: attackName ? attackName : `${game.i18n.localize("PF1.Attack")}` }];

  // Formulaic extra attacks
  if (shared.fullAttack) {
    const exAtkCountFormula = getProperty(this.data, "data.formulaicAttacks.count.formula"),
      exAtkCount = RollPF.safeRoll(exAtkCountFormula, shared.rollData)?.total ?? 0,
      exAtkBonusFormula = this.data.data.formulaicAttacks?.bonus?.formula || "0";
    if (exAtkCount > 0) {
      try {
        const frollData = shared.rollData;
        const fatlabel = this.data.data.formulaicAttacks.label || game.i18n.localize("PF1.FormulaAttack");
        for (let i = 0; i < exAtkCount; i++) {
          frollData["formulaicAttack"] = i + 1; // Add and update attack counter
          const bonus = RollPF.safeRoll(exAtkBonusFormula, frollData).total;
          allAttacks.push({
            attackBonus: `(${bonus})[${game.i18n.localize("PF1.Iterative")}]`,
            label: fatlabel.format(i + 2),
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  return allAttacks;
};

/**
 * Subtracts ammo for this attack.
 *
 * @param {Object} shared - Shared data between attack functions.
 * @param {number} [value=1] - How much ammo to subtract.
 * @returns {Promise}
 */
export const subtractAmmo = function (shared, value = 1) {
  if (!shared.ammoLinks.length) return;
  const promises = [];
  for (const l of shared.ammoLinks) {
    promises.push(l.item.addCharges(-value));
  }
  return Promise.all(promises);
};

/**
 * @param {Object} shared - Shared data between attack functions.
 */
export const handleConditionals = function (shared) {
  // Helper to get localized name from CONFIG.PF1 objects
  const localizeType = (target, type) => {
    const result = this.getConditionalModifierTypes(target);
    return game.i18n.localize(result[type]) || type;
  };

  if (shared.conditionals) {
    const conditionalData = {};
    for (const i of shared.conditionals) {
      const conditional = this.data.data.conditionals[i];
      const tag = createTag(conditional.name);
      for (const [i, modifier] of conditional.modifiers.entries()) {
        // Adds a formula's result to rollData to allow referencing it.
        // Due to being its own roll, this will only correctly work for static formulae.
        const conditionalRoll = RollPF.safeRoll(modifier.formula, shared.rollData);
        if (conditionalRoll.err) {
          const msg = game.i18n.format("PF1.WarningConditionalRoll", { number: i + 1, name: conditional.name });
          console.warn(msg);
          ui.notifications.warn(msg);
          // Skip modifier to avoid multiple errors from one non-evaluating entry
          continue;
        } else conditionalData[[tag, i].join(".")] = RollPF.safeRoll(modifier.formula, shared.rollData).total;

        // Create a key string for the formula array
        const partString = `${modifier.target}.${modifier.subTarget}${
          modifier.critical ? "." + modifier.critical : ""
        }`;
        // Add formula in simple format
        if (["attack", "effect", "misc"].includes(modifier.target)) {
          const hasFlavor = /\[.*\]/.test(modifier.formula);
          const flavoredFormula = hasFlavor ? modifier.formula : `(${modifier.formula})[${conditional.name}]`;
          shared.conditionalPartsCommon[partString] = [
            ...(shared.conditionalPartsCommon[partString] ?? []),
            flavoredFormula,
          ];
        }
        // Add formula as array for damage
        else if (modifier.target === "damage") {
          shared.conditionalPartsCommon[partString] = [
            ...(shared.conditionalPartsCommon[partString] ?? []),
            Object.values(CONFIG.PF1.bonusModifiers).includes(modifier.type)
              ? [modifier.formula, modifier.type, true]
              : [modifier.formula, localizeType(modifier.target, modifier.type), false],
          ];
        }
        // Add formula to the size property
        else if (modifier.target === "size") {
          shared.rollData.size += conditionalRoll.total;
        }
      }
    }
    // Expand data into rollData to enable referencing in formulae
    shared.rollData.conditionals = expandObject(conditionalData, 5);

    // Add specific pre-rolled rollData entries
    for (const target of ["effect.cl", "effect.dc", "misc.charges"]) {
      if (shared.conditionalPartsCommon[target] != null) {
        const formula = shared.conditionalPartsCommon[target].join("+");
        const roll = RollPF.safeRoll(formula, shared.rollData, [target, formula]).total;
        switch (target) {
          case "effect.cl":
            shared.rollData.cl += roll;
            break;
          case "effect.dc":
            shared.rollData.dcBonus = roll;
            break;
          case "misc.charges":
            shared.rollData.chargeCostBonus = roll;
            break;
        }
      }
    }
  }
};

/**
 * Checks all requirements to make the attack. This is after the attack dialog's data has been parsed.
 *
 * @param {Object} shared - Shared data between attack functions.
 * @returns {number} 0 if successful, otherwise one of the ERR_REQUIREMENT constants.
 */
export const checkAttackRequirements = function (shared) {
  // Determine charge cost
  let cost = 0;
  if (this.autoDeductCharges) {
    cost = this.chargeCost;
    let uses = this.charges;
    if (this.data.type === "spell" && this.useSpellPoints()) {
      cost = this.getSpellPointCost(shared.rollData);
      uses = this.getSpellUses();
    }
    // Add charge cost from conditional modifiers
    cost += shared.rollData["chargeCostBonus"] ?? 0;

    // Cancel usage on insufficient charges
    if (cost > uses) {
      const msg = game.i18n.localize("PF1.ErrorInsufficientCharges").format(this.name);
      console.warn(msg);
      ui.notifications.warn(msg);
      return ERR_REQUIREMENT.INSUFFICIENT_CHARGES;
    }
  }

  // Save chargeCost as rollData entry for following formulae
  shared.rollData.chargeCost = cost;

  return 0;
};

/**
 * Generates ChatAttack entries based off the attack type.
 *
 * @param {Object} shared - Shared data between attack functions.
 */
export const generateChatAttacks = async function (shared) {
  // Normal attack(s)
  if (this.hasAttack) await game.pf1.ItemAttack.addAttacks.call(this, shared);
  // Damage only
  else if (this.hasDamage) await game.pf1.ItemAttack.addDamage.call(this, shared);
  // Effect notes only
  else await game.pf1.ItemAttack.addEffectNotes.call(this, shared);

  // Add attack cards
  if (shared.ammoLinks.length) {
    shared.chatAttacks.forEach((atk) => atk.addAmmunitionCards());
  }

  // Add save info
  shared.save = getProperty(this.data, "data.save.type");
  shared.saveDC = this.getDC(shared.rollData);
};

/**
 * Adds ChatAttack entries to an attack's shared context.
 *
 * @param {Object} shared - Shared data between attack functions.
 */
export const addAttacks = async function (shared) {
  shared.ammoRequired = Math.min(shared.attacks.length, shared.ammoAvailable);

  for (
    let a = 0;
    (shared.ammoLinks.length && shared.ammoUsed < shared.ammoRequired) ||
    (!shared.ammoLinks.length && a < shared.attacks.length);
    a++
  ) {
    const atk = shared.attacks[a];

    // Combine conditional modifiers for attack and damage
    const conditionalParts = {
      "attack.normal": [
        ...(shared.conditionalPartsCommon[`attack.attack.${a}.normal`] ?? []),
        ...(shared.conditionalPartsCommon["attack.allAttack.normal"] ?? []),
      ], //`
      "attack.crit": [
        ...(shared.conditionalPartsCommon[`attack.attack.${a}.crit`] ?? []),
        ...(shared.conditionalPartsCommon["attack.allAttack.crit"] ?? []),
      ], //`
      "damage.normal": [
        ...(shared.conditionalPartsCommon[`damage.attack.${a}.normal`] ?? []),
        ...(shared.conditionalPartsCommon["damage.allDamage.normal"] ?? []),
      ], //`
      "damage.crit": [
        ...(shared.conditionalPartsCommon[`damage.attack.${a}.crit`] ?? []),
        ...(shared.conditionalPartsCommon["damage.allDamage.crit"] ?? []),
      ], //`
      "damage.nonCrit": [
        ...(shared.conditionalPartsCommon[`damage.attack.${a}.nonCrit`] ?? []),
        ...(shared.conditionalPartsCommon["damage.allDamage.nonCrit"] ?? []),
      ], //`
    };

    // Create attack object
    const attack = new ChatAttack(this, {
      label: atk.label,
      primaryAttack: shared.rollData.item?.primaryAttack !== false,
      rollData: shared.rollData,
      targets: game.user.targets,
    });

    // Add attack roll
    await attack.addAttack({
      extraParts: duplicate(shared.attackBonus).concat([atk.attackBonus]),
      conditionalParts,
    });

    // Add damage
    if (this.hasDamage) {
      await attack.addDamage({ extraParts: duplicate(shared.damageBonus), critical: false, conditionalParts });

      // Add critical hit damage
      if (attack.hasCritConfirm) {
        await attack.addDamage({ extraParts: duplicate(shared.damageBonus), critical: true, conditionalParts });
      }
    }

    // Add attack notes
    if (a === 0) attack.addAttackNotes();

    // Add effect notes
    attack.addEffectNotes();

    // Add to list
    shared.chatAttacks.push(attack);
    shared.ammoUsed++;
  }
};

/**
 * Adds a ChatAttack entry for damage to an attack's shared context.
 *
 * @param {Object} shared - Shared data between attack functions.
 */
export const addDamage = async function (shared) {
  shared.ammoUsed = 1;

  // Set conditional modifiers
  shared.conditionalParts = {
    "damage.normal": shared.conditionalPartsCommon["damage.allDamage.normal"] ?? [],
  };

  const attack = new ChatAttack(this, { rollData: shared.rollData, primaryAttack: shared.primaryAttack });
  // Add damage
  await attack.addDamage({
    extraParts: duplicate(shared.damageBonus),
    critical: false,
    conditionalParts: shared.conditionalParts,
  });

  // Add effect notes
  attack.addEffectNotes();

  // Add to list
  shared.chatAttacks.push(attack);
};

/**
 * Adds a ChatAttack entry for effect notes to an attack's shared context.
 *
 * @param {Object} shared - Shared data between attack functions.
 */
export const addEffectNotes = async function (shared) {
  const attack = new ChatAttack(this, { rollData: shared.rollData, primaryAttack: shared.primaryAttack });

  // Add effect notes
  attack.addEffectNotes();

  // Add to list
  shared.chatAttacks.push(attack);
};

/**
 * @typedef {Object} Attack_MeasureTemplateResult
 * @property {boolean} result - Whether an area was selected.
 * @property {Function} [place] - Function to place the template, if an area was selected.
 * @property {Function} [delete] - Function to delete the template, if it has been placed.
 */
/**
 * Prompts the user for an area, based on the attack's measure template.
 *
 * @param {Object} shared - Shared data between attack functions.
 * @returns {Promise.<Attack_MeasureTemplateResult>} Whether an area was selected.
 */
export const promptMeasureTemplate = async function (shared) {
  // Determine size
  let dist = getProperty(this.data, "data.measureTemplate.size");
  if (typeof dist === "string") {
    dist = RollPF.safeRoll(getProperty(this.data, "data.measureTemplate.size"), shared.rollData).total;
  }
  dist = convertDistance(dist)[0];

  // Create data object
  const templateOptions = {
    type: getProperty(this.data, "data.measureTemplate.type"),
    distance: dist,
  };
  if (getProperty(this.data, "data.measureTemplate.overrideColor")) {
    templateOptions.color = getProperty(this.data, "data.measureTemplate.customColor");
  }
  if (getProperty(this.data, "data.measureTemplate.overrideTexture")) {
    templateOptions.texture = getProperty(this.data, "data.measureTemplate.customTexture");
  }

  // Create template
  shared.template = null;
  const template = game.pf1.AbilityTemplate.fromData(templateOptions);
  let result;
  if (template) {
    const sheetRendered = this.parent?.sheet?._element != null;
    if (sheetRendered) this.parent.sheet.minimize();
    result = await template.drawPreview(shared.event);
    if (!result.result) {
      if (sheetRendered) this.parent.sheet.maximize();
      return result;
    }
  }

  shared.template = await result.place();
  return result;
};

/**
 * Handles Dice So Nice integration.
 *
 * @param {Object} shared - Shared data between attack functions.
 */
export const handleDiceSoNice = async function (shared) {
  if (game.dice3d != null && game.dice3d.isEnabled()) {
    // Use try to make sure a chat card is rendered even if DsN fails
    try {
      // Define common visibility options for whole attack
      const chatData = {};
      ChatMessage.applyRollMode(chatData, shared.rollMode);

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

      for (const atk of shared.chatAttacks) {
        // Create PoolTerm for attack and damage rolls
        const attackPool = new PoolTerm();
        if (atk.attack.roll) attackPool.rolls.push(atk.attack.roll);
        attackPool.rolls.push(...(atk.damage?.rolls?.map((dmgRoll) => dmgRoll.roll) ?? []));

        // Create PoolTerm for crit confirmation and crit damage rolls
        const critPool = new PoolTerm();
        if (atk.hasCritConfirm) critPool.rolls.push(atk.critConfirm.roll);
        critPool.rolls.push(...(atk.critDamage?.rolls?.map((dmgRoll) => dmgRoll.roll) ?? []));

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
};

/**
 * Adds an attack's chat card data to the shared object.
 *
 * @param {Object} shared - Shared data between attack functions.
 */
export const getMessageData = async function (shared) {
  if (shared.chatAttacks.length === 0) return;

  // Create chat template data
  shared.templateData = {
    name: this.name,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    rollMode: shared.rollMode,
    attacks: shared.chatAttacks.map((o) => o.finalize()),
  };

  // Set chat data
  shared.chatData = {
    speaker: ChatMessage.getSpeaker({ actor: this.parent }),
    rollMode: shared.rollMode,
  };

  // Set attack sound
  if (this.data.data.soundEffect) shared.chatData.sound = this.data.data.soundEffect;
  // Set dice sound if neither attack sound nor Dice so Nice are available
  else if (game.dice3d == null || !game.dice3d.isEnabled()) shared.chatData.sound = CONFIG.sounds.dice;

  // Get extra text
  const props = [];
  let extraText = "";
  if (shared.templateData.attacks.length > 0) extraText = shared.templateData.attacks[0].attackNotesHTML;

  const itemChatData = this.getChatData(null, shared.rollData);

  // Get properties
  const properties = [...itemChatData.properties, ...game.pf1.ItemAttack.addGenericPropertyLabels.call(this, shared)];
  if (properties.length > 0) props.push({ header: game.i18n.localize("PF1.InfoShort"), value: properties });

  // Get combat properties
  if (game.combat) {
    const combatProps = game.pf1.ItemAttack.addCombatPropertyLabels.call(this, shared);

    if (combatProps.length > 0) {
      props.push({ header: game.i18n.localize("PF1.CombatInfo_Header"), value: combatProps });
    }
  }

  // Add CL notes
  if (this.data.type === "spell" && this.parent) {
    const clNotes = this.parent.getContextNotesParsed(`spell.cl.${this.data.data.spellbook}`);

    if (clNotes.length) {
      props.push({
        header: game.i18n.localize("PF1.CLNotes"),
        value: clNotes,
      });
    }
  }

  // Parse template data
  const token =
    this.parentActor?.token ?? canvas.tokens.placeables.find((t) => t.actor && t.actor.id === this.parentActor?.id);
  shared.templateData = mergeObject(
    shared.templateData,
    {
      tokenUuid: token ? token.document?.uuid ?? token.uuid : null,
      extraText: extraText,
      data: itemChatData,
      hasExtraText: extraText.length > 0,
      properties: props,
      hasProperties: props.length > 0,
      item: this.data,
      actor: this.parent.data,
      hasSave: this.hasSave,
      description: this.fullDescription,
      rollData: shared.rollData,
      save: {
        dc: shared.saveDC,
        type: shared.save,
        label: game.i18n.format("PF1.SavingThrowButtonLabel", {
          0: CONFIG.PF1.savingThrows[shared.save],
          1: shared.saveDC.toString(),
        }),
        gmSensitiveLabel: game.i18n.format("PF1.SavingThrowButtonLabelGMSensitive", {
          save: CONFIG.PF1.savingThrows[shared.save],
        }),
      },
    },
    { inplace: false }
  );

  // Add range info
  {
    const range = this.range;
    if (range != null) {
      shared.templateData.range = range;
      if (typeof range === "string") {
        shared.templateData.range = RollPF.safeRoll(range, shared.rollData).total;
        shared.templateData.rangeFormula = range;
      }
      let usystem = game.settings.get("pf1", "distanceUnits"); // override
      if (usystem === "default") usystem = game.settings.get("pf1", "units");
      shared.templateData.rangeLabel =
        usystem === "metric" ? `${shared.templateData.range} m` : `${shared.templateData.range} ft.`;

      const rangeUnits = getProperty(this.data, "data.range.units");
      if (["melee", "touch", "reach", "close", "medium", "long"].includes(rangeUnits)) {
        shared.templateData.rangeLabel = CONFIG.PF1.distanceUnits[rangeUnits];
      }
    }
  }

  // Add spell info
  if (this.type === "spell" && this.parent != null) {
    // Spell failure
    if (this.parent.spellFailure > 0) {
      const spellbook = getProperty(this.parent.data, `data.attributes.spells.spellbooks.${this.data.data.spellbook}`);
      if (spellbook && spellbook.arcaneSpellFailure) {
        const roll = RollPF.safeRoll("1d100");
        shared.templateData.spellFailure = roll.total;
        shared.templateData.spellFailureRoll = roll;
        shared.templateData.spellFailureSuccess = shared.templateData.spellFailure > this.parentActor.spellFailure;
      }
    }
    // Caster Level Check
    shared.templateData.casterLevelCheck = shared.casterLevelCheck;
    // Concentration check
    shared.templateData.concentrationCheck = shared.concentrationCheck;
  }

  // Generate metadata
  const metadata = game.pf1.ItemAttack.generateChatMetadata.call(this, shared);

  // Get target info
  if (!game.settings.get("pf1", "disableAttackCardTargets")) {
    const targets = metadata.targets?.length
      ? metadata.targets.map((o) => canvas.tokens.get(o)).filter((o) => o != null)
      : [];
    if (targets.length) {
      shared.templateData.targets = targets.map((o) => {
        return {
          actorData: o.actor.data,
          tokenData: o.data,
          uuid: o.actor.uuid,
        };
      });
    }
  }

  shared.chatData["flags.pf1.metadata"] = metadata;
  shared.chatData["flags.core.canPopout"] = true;
};

/**
 * Adds generic property labels to an attack's chat card.
 *
 * @param {Object} shared - Shared data between attack functions.
 * @returns {string[]} The resulting property labels.
 */
export const addGenericPropertyLabels = function (shared) {
  const properties = [];

  // Add actual cost
  const cost = shared.rollData.chargeCost;
  if (cost && !this.data.data.atWill) {
    if (this.data.type === "spell" && this.useSpellPoints()) {
      properties.push(`${game.i18n.localize("PF1.SpellPointsCost")}: ${cost}`);
    } else {
      properties.push(`${game.i18n.localize("PF1.ChargeCost")}: ${cost}`);
    }
  }

  // Add info for broken state
  if (this.data.data.broken) {
    properties.push(game.i18n.localize("PF1.Broken"));
  }

  // Nonlethal
  if (this.data.data.nonlethal) properties.push(game.i18n.localize("PF1.Nonlethal"));

  // Add info for Power Attack to melee, Deadly Aim to ranged attacks
  if (shared.powerAttack) {
    if (this.data.data.actionType === "rwak") properties.push(game.i18n.localize("PF1.DeadlyAim"));
    if (this.data.data.actionType === "mwak") properties.push(game.i18n.localize("PF1.PowerAttack"));
  }

  // Add info for Point-Blank shot
  if (shared.pointBlankShot) properties.push(game.i18n.localize("PF1.PointBlankShot"));

  // Add info for Rapid Shot
  if (shared.attacks.find((o) => o.id === "rapidshot")) properties.push(game.i18n.localize("PF1.RapidShot"));

  // Add ammo-remaining counter or out-of-ammunition warning
  if (shared.ammoLinks.length) {
    if (shared.ammoUsed === shared.ammoAvailable) {
      properties.push(game.i18n.localize("PF1.AmmoDepleted"));
    } else {
      properties.push(game.i18n.localize("PF1.AmmoRemaining").format(shared.ammoAvailable - shared.ammoUsed));
    }
  }

  // Add Armor Check Penalty's application to attack rolls info
  if (this.hasAttack && shared.rollData.attributes.acp.attackPenalty > 0)
    properties.push(game.i18n.localize("PF1.ArmorCheckPenalty"));

  // Add conditionals info
  if (shared.conditionals?.length) {
    shared.conditionals.forEach((c) => {
      properties.push(this.data.data.conditionals[c].name);
    });
  }

  // Add Wound Thresholds info
  if (shared.rollData.attributes.woundThresholds.level > 0)
    properties.push(
      game.i18n.localize(CONFIG.PF1.woundThresholdConditions[shared.rollData.attributes.woundThresholds.level])
    );

  return properties;
};

/**
 * Adds combat property labels to an attack's chat card.
 *
 * @param {Object} shared - Shared data between attack functions.
 * @returns {string[]} The resulting property labels.
 */
export const addCombatPropertyLabels = function (shared) {
  const properties = [];

  // Add round info
  properties.push(game.i18n.localize("PF1.CombatInfo_Round").format(game.combat.round));

  return properties;
};

/**
 * Generates metadata for this attack for the chat card to store.
 *
 * @param {Object} shared - Shared data between attack functions.
 * @returns {Object} The resulting metadata object.
 */
export const generateChatMetadata = function (shared) {
  const metadata = {};

  metadata.item = this.id;
  metadata.template = shared.template ? shared.template.id : null;
  metadata.rolls = {
    attacks: {},
  };

  // Get template for later variables
  const template = canvas.templates.get(metadata.template);

  // Add targets
  if (template != null) {
    metadata.targets = template.getTokensWithin().map((o) => o.id);
  } else {
    metadata.targets = Array.from(game.user.targets).map((o) => o.id);
  }

  // Add attack rolls
  for (let a = 0; a < shared.chatAttacks.length; a++) {
    const atk = shared.chatAttacks[a];
    const attackRolls = { attack: null, damage: {}, critConfirm: null, critDamage: {} };
    // Add attack roll
    if (atk.attack.roll) attackRolls.attack = atk.attack.roll.toJSON();
    // Add damage rolls
    if (atk.damage.rolls.length) {
      for (let b = 0; b < atk.damage.rolls.length; b++) {
        const r = atk.damage.rolls[b];
        attackRolls.damage[b] = {
          damageType: r.damageType,
          roll: r.roll.toJSON(),
        };
      }
    }
    // Add critical confirmation roll
    if (atk.critConfirm.roll) attackRolls.critConfirm = atk.critConfirm.roll.toJSON();
    // Add critical damage rolls
    if (atk.critDamage.rolls.length) {
      for (let b = 0; b < atk.critDamage.rolls.length; b++) {
        const r = atk.critDamage.rolls[b];
        attackRolls.critDamage[b] = {
          damageType: r.damageType,
          roll: r.roll.toJSON(),
        };
      }
    }

    metadata.rolls.attacks[a] = attackRolls;
  }

  // Add miscellaneous metadata
  const ammoId = shared.ammoLinks?.filter((l) => l.item.charges > 0).map((l) => l.item.id);
  if (ammoId.length > 0) metadata.ammo = { id: ammoId, quantity: shared.ammoUsed };
  if (shared.saveDC) metadata.save = { dc: shared.saveDC, type: shared.save };
  if (this.type === "spell") metadata.spell = { cl: shared.rollData.cl, sl: shared.rollData.sl };

  return metadata;
};

/**
 * Executes the item's script calls.
 *
 * @param {Object} shared - Shared data between attack functions.
 * @returns {Object} The resulting data from the script calls.
 */
export const executeScriptCalls = async function (shared) {
  // Extra options for script call
  const data = { chatMessage: shared.chatMessage, fullAttack: shared.fullAttack };

  // Execute script call
  shared.scriptData = await this.executeScriptCalls("use", {
    attacks: shared.chatAttacks,
    template: shared.template,
    data,
    conditionals: shared.conditionals?.map((c) => this.data.data.conditionals[c]) ?? [],
  });
};

/**
 * Posts the attack's chat card.
 *
 * @param {Object} shared - Shared data between attack functions.
 */
export const postMessage = async function (shared) {
  Hooks.call("itemUse", this, "postAttack", {
    ev: shared.event,
    skipDialog: shared.skipDialog,
    chatData: shared.chatData,
    templateData: shared.templateData,
  });

  // Create message
  const t = game.settings.get("pf1", "attackChatCardTemplate");

  // Show chat message
  let result;
  if (shared.chatAttacks.length > 0) {
    if (shared.chatMessage && shared.scriptData.hideChat !== true)
      result = await createCustomChatMessage(t, shared.templateData, shared.chatData);
    else result = { template: t, data: shared.templateData, chatData: shared.chatData };
  } else {
    if (shared.chatMessage && shared.scriptData.hideChat !== true) result = this.roll();
    else result = { descriptionOnly: true };
  }

  return result;
};
