import { createTag, convertDistance } from "../lib.js";
import { ChatAttack } from "../misc/chat-attack.js";
import { createCustomChatMessage } from "../chat.js";
import { RollPF } from "../roll.js";

export const ERR_REQUIREMENT = {
  NO_ACTOR_PERM: 1,
  DISABLED: 2,
  INSUFFUCIENT_QUANTITY: 3,
  INSUFFICIENT_CHARGES: 4,
  MISSING_AMMO: 5,
  INSUFFICIENT_AMMO: 6,
};

/**
 * @param {object} shared - Shared data between attack functions.
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

  if (this.type === "feat" && this.system.disabled) {
    const msg = game.i18n.localize("PF1.ErrorFeatDisabled");
    console.warn(msg);
    ui.notifications.warn(msg);
    return ERR_REQUIREMENT.DISABLED;
  }

  const itemQuantity = getProperty(this, "system.quantity");
  if (itemQuantity != null && itemQuantity <= 0) {
    const msg = game.i18n.localize("PF1.ErrorNoQuantity");
    console.warn(msg);
    ui.notifications.warn(msg);
    return ERR_REQUIREMENT.INSUFFUCIENT_QUANTITY;
  }

  if (this.isCharged && this.charges < shared.chargeCost) {
    const msg = game.i18n.localize("PF1.ErrorInsufficientCharges").format(this.name);
    console.warn(msg);
    ui.notifications.warn(msg);
    return ERR_REQUIREMENT.INSUFFICIENT_CHARGES;
  }

  return 0;
};

/**
 * @param {object} shared - Shared data between attack functions.
 * @returns {object} The roll data object for this attack.
 */
export const getRollData = function (shared) {
  const rollData = duplicate(shared.action.getRollData());
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
 * @param {object} shared - Shared data between attack functions.
 * @returns {ItemAttack_Dialog_Result|boolean}
 */
export const createAttackDialog = async function (shared) {
  const dialog = new game.pf1.applications.AttackDialog(shared.action, shared.rollData);
  return dialog.show();
};

/**
 * Alters roll (and shared) data based on user input during the attack's dialog.
 *
 * @param {object} shared - Shared data between attack functions.
 * @param {JQuery | object} form - The attack dialog's jQuery form data or FormData object
 */
export const alterRollData = function (shared, form = {}) {
  let formData;
  if (form instanceof jQuery) formData = new FormDataExtended(form[0].querySelector("form")).object;
  else formData = form;
  if (formData["d20"]) shared.rollData.d20 = formData["d20"];
  const atkBonus = formData["attack-bonus"];
  if (atkBonus) {
    shared.attackBonus.push(atkBonus);
  }
  const dmgBonus = formData["damage-bonus"];
  if (dmgBonus) {
    shared.damageBonus.push(dmgBonus);
  }
  shared.rollMode = formData["rollMode"] ?? game.settings.get("core", "rollMode");

  // Point-Blank Shot
  if (formData["point-blank-shot"]) {
    shared.attackBonus.push(`1[${game.i18n.localize("PF1.PointBlankShot")}]`);
    shared.damageBonus.push(`1[${game.i18n.localize("PF1.PointBlankShot")}]`);
    shared.pointBlankShot = true;
  }

  // Many-shot
  if (shared.fullAttack && formData["manyshot"]) {
    shared.manyShot = true;
  }

  // Rapid Shot
  if (shared.fullAttack && formData["rapid-shot"]) {
    shared.attackBonus.push(`-2[${game.i18n.localize("PF1.RapidShot")}]`);
  }

  // Primary attack
  if (formData["primary-attack"] != null) shared.rollData.item.primaryAttack = formData["primary-attack"];

  // Use measure template
  if (formData["measure-template"] != null) shared.useMeasureTemplate = formData["measure-template"];

  // Set held type
  setProperty(shared.rollData, "item.held", formData["held"] ?? "normal");

  // Damage multiplier
  if (formData["damage-ability-multiplier"] != null)
    shared.rollData.action.ability.damageMult = formData["damage-ability-multiplier"];

  // Power Attack
  if (formData["power-attack"]) {
    const basePowerAttackBonus = shared.rollData.action?.powerAttack?.damageBonus ?? 2;
    let powerAttackBonus = (1 + Math.floor(shared.rollData.attributes.bab.total / 4)) * basePowerAttackBonus;

    // Get multiplier
    let powerAttackMultiplier = shared.rollData.item?.powerAttack?.multiplier;
    if (!powerAttackMultiplier) {
      powerAttackMultiplier = 1;
      if (this.system.attackType === "natural") {
        if (shared.rollData.item?.primaryAttack) powerAttackMultiplier = shared.rollData.action.ability?.damageMult;
        else if (!shared.rollData.item?.primaryAttack) {
          powerAttackMultiplier = shared.rollData.action.naturalAttack?.secondary?.damageMult ?? 0.5;
        }
      } else {
        if (shared.rollData?.item?.held === "2h") powerAttackMultiplier = 1.5;
        else if (shared.rollData?.item?.held === "oh") powerAttackMultiplier = 0.5;
      }
    } else {
      powerAttackMultiplier = parseFloat(powerAttackMultiplier);
    }

    // Apply multiplier
    powerAttackBonus = Math.floor(powerAttackBonus * powerAttackMultiplier);

    // Get label
    const label = ["rwak", "rsak"].includes(this.system.actionType)
      ? game.i18n.localize("PF1.DeadlyAim")
      : game.i18n.localize("PF1.PowerAttack");

    // Get penalty
    const powerAttackPenalty = -(1 + Math.floor(getProperty(shared.rollData, "attributes.bab.total") / 4));

    // Add bonuses
    shared.rollData.powerAttackPenalty = powerAttackPenalty;
    shared.attackBonus.push(`${powerAttackPenalty}[${label}]`);
    shared.powerAttack = true;
    shared.rollData.powerAttackBonus = powerAttackBonus;
    shared.rollData.powerAttackPenalty = powerAttackPenalty;
  } else {
    shared.rollData.powerAttackBonus = 0;
    shared.rollData.powerAttackPenalty = 0;
  }

  // Conditionals
  Object.keys(formData).forEach((f) => {
    const idx = f.match(/conditional\.(\d+)/)?.[1];
    if (idx && formData[f]) {
      if (!shared.conditionals) shared.conditionals = [parseInt(idx)];
      else shared.conditionals.push(parseInt(idx));
    }
  });

  // Apply secondary attack penalties
  if (shared.rollData.item.attackType === "natural" && shared.rollData.item.primaryAttack === false) {
    const attackBonus = shared.rollData.action.naturalAttack?.secondary?.attackBonus || "-5";
    const damageMult = shared.rollData.action.naturalAttack?.secondary?.damageMult ?? 0.5;
    shared.attackBonus.push(`(${attackBonus})[${game.i18n.localize("PF1.SecondaryAttack")}]`);
    shared.rollData.action.ability.damageMult = damageMult;
  }

  // CL check enabled
  shared.casterLevelCheck = formData["cl-check"];

  // Concentration enabled
  shared.concentrationCheck = formData["concentration"];

  // Conditional defaults for fast-forwarding
  if (!shared.conditionals && foundry.utils.isEmpty(formData)) {
    shared.conditionals = shared.action.data.conditionals?.reduce((arr, con, i) => {
      if (con.default) arr.push(i);
      return arr;
    }, []);
  }
};

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
 * @param {object} shared - Shared data between attack functions.
 * @param {boolean} [forceFullAttack=false] - Generate full attack data, e.g. as base data for an {@link AttackDialog}
 * @returns {ItemAttack_AttackData[]} The generated default attacks.
 */
export const generateAttacks = function (shared, forceFullAttack = false) {
  const rollData = shared.rollData;
  const action = rollData.action;

  /**
   * Counter for unnamed or other numbered attacks, to be incremented with each usage.
   * Starts at 1 to account for the base attack.
   */
  let unnamedAttackIndex = 1;

  const attackName = action.attackName || game.i18n.format("PF1.FormulaAttack", { 0: unnamedAttackIndex });
  // Use either natural fullAttack state, or force generation of all attacks via override
  const fullAttack = forceFullAttack || shared.fullAttack;

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
          rollData["formulaicAttack"] = i + 1; // Add and update attack counter
          const bonus = RollPF.safeRoll(exAtkBonusFormula, rollData).total;
          allAttacks.push({
            attackBonus: `(${bonus})[${game.i18n.localize("PF1.Iterative")}]`,
            // If formulaic attacks have a non-default name, number them with their own counter; otherwise, continue unnamed attack numbering
            label: action.formulaicAttacks.label
              ? action.formulaicAttacks.label.format(i + 1)
              : game.i18n.format("PF1.FormulaAttack", { 0: (unnamedAttackIndex += 1) }),
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  // Set ammo usage
  if (action.usesAmmo) {
    const ammoId = this.getFlag("pf1", "defaultAmmo");
    const item = this.actor.items.get(ammoId);
    const quantity = item?.system.quantity ?? 0;
    const abundant = item?.flags.pf1?.abundant;
    for (let a = 0; a < allAttacks.length; a++) {
      const atk = allAttacks[a];
      if (abundant || quantity >= a + 1) atk.ammo = ammoId;
      else atk.ammo = null;
    }
  }

  return allAttacks;
};

/**
 * Subtracts ammo for this attack.
 *
 * @param {object} shared - Shared data between attack functions.
 * @param {number} [value=1] - How much ammo to subtract.
 * @returns {Promise}
 */
export const subtractAmmo = function (shared, value = 1) {
  if (!shared.action.data.usesAmmo) return;

  const ammoUsage = {};
  for (const atk of shared.attacks) {
    if (atk.ammo) {
      const item = this.actor.items.get(atk.ammo);
      // Don't remove abundant ammunition
      if (item.data.flags?.pf1?.abundant) continue;

      if (!ammoUsage[atk.ammo]) ammoUsage[atk.ammo] = 1;
      else ammoUsage[atk.ammo]++;
    }
  }

  if (!foundry.utils.isEmpty(ammoUsage)) {
    const updateData = Object.entries(ammoUsage).reduce((cur, o) => {
      const currentValue = this.actor.items.get(o[0]).system.quantity;
      const obj = {
        _id: o[0],
        "system.quantity": currentValue - o[1],
      };

      cur.push(obj);
      return cur;
    }, []);

    return this.actor.updateEmbeddedDocuments("Item", updateData);
  }
};

/**
 * @param {object} shared - Shared data between attack functions.
 */
export const handleConditionals = function (shared) {
  if (shared.conditionals) {
    const conditionalData = {};
    for (const i of shared.conditionals) {
      const conditional = shared.action.data.conditionals[i];
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
            [modifier.formula, modifier.damageType, false],
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
 * @param {object} shared - Shared data between attack functions.
 * @returns {number} 0 if successful, otherwise one of the ERR_REQUIREMENT constants.
 */
export const checkAttackRequirements = function (shared) {
  // Enforce zero charge cost on cantrips/orisons, but make sure they have at least 1 charge
  if (
    this.system.type === "spell" &&
    shared.rollData.item?.level === 0 &&
    shared.rollData.item?.preparation?.preparedAmount > 0
  ) {
    shared.rollData.chargeCost = 0;
    return 0;
  }

  // Determine charge cost
  let cost = 0;
  if (this.isCharged) {
    cost = shared.action.chargeCost;
    let uses = this.charges;
    if (this.system.type === "spell") {
      if (this.useSpellPoints()) {
        uses = this.getSpellUses();
      } else {
        cost = 1;
      }
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
 * @param {object} shared - Shared data between attack functions.
 */
export const generateChatAttacks = async function (shared) {
  // Normal attack(s)
  if (shared.action.hasAttack) await game.pf1.ItemAttack.addAttacks.call(this, shared);
  // Damage only
  else if (shared.action.hasDamage) await game.pf1.ItemAttack.addDamage.call(this, shared);
  // Effect notes only
  else await game.pf1.ItemAttack.addEffectNotes.call(this, shared);

  // Add attack cards
  shared.attacks.forEach((attack) => {
    if (!attack.ammo) return;
    const atk = attack.chatAttack;
    if (atk) atk.setAmmo(attack.ammo);
  });

  // Add save info
  shared.save = shared.action.data.save.type;
  shared.saveDC = shared.action.getDC(shared.rollData);
};

/**
 * Adds ChatAttack entries to an attack's shared context.
 *
 * @param {object} shared - Shared data between attack functions.
 */
export const addAttacks = async function (shared) {
  for (let a = 0; a < shared.attacks.length; a++) {
    const atk = shared.attacks[a];

    // Combine conditional modifiers for attack and damage
    const conditionalParts = {
      "attack.normal": [
        ...(shared.conditionalPartsCommon[`attack.attack_${a}.normal`] ?? []),
        ...(shared.conditionalPartsCommon["attack.allAttack.normal"] ?? []),
      ], //`
      "attack.crit": [
        ...(shared.conditionalPartsCommon[`attack.attack_${a}.crit`] ?? []),
        ...(shared.conditionalPartsCommon["attack.allAttack.crit"] ?? []),
      ], //`
      "damage.normal": [
        ...(shared.conditionalPartsCommon[`damage.attack_${a}.normal`] ?? []),
        ...(shared.conditionalPartsCommon["damage.allDamage.normal"] ?? []),
      ], //`
      "damage.crit": [
        ...(shared.conditionalPartsCommon[`damage.attack_${a}.crit`] ?? []),
        ...(shared.conditionalPartsCommon["damage.allDamage.crit"] ?? []),
      ], //`
      "damage.nonCrit": [
        ...(shared.conditionalPartsCommon[`damage.attack_${a}.nonCrit`] ?? []),
        ...(shared.conditionalPartsCommon["damage.allDamage.nonCrit"] ?? []),
      ], //`
    };

    shared.rollData.attackCount = a;

    // Create attack object
    const attack = new ChatAttack(shared.action, {
      label: atk.label,
      rollData: shared.rollData,
      targets: game.user.targets,
    });

    if (atk.id !== "manyshot") {
      // Add attack roll
      await attack.addAttack({
        extraParts: duplicate(shared.attackBonus).concat([atk.attackBonus]),
        conditionalParts,
      });
    }

    // Add damage
    if (shared.action.hasDamage) {
      const extraParts = duplicate(shared.damageBonus);
      const nonCritParts = [];
      const critParts = [];

      // Add power attack bonus
      if (shared.rollData.powerAttackBonus > 0) {
        // Get label
        const label = ["rwak", "rsak"].includes(shared.action.data.actionType)
          ? game.i18n.localize("PF1.DeadlyAim")
          : game.i18n.localize("PF1.PowerAttack");

        const powerAttackBonus = shared.rollData.powerAttackBonus;
        const powerAttackCritBonus = powerAttackBonus * (shared.rollData.item?.powerAttack?.critMultiplier ?? 1);
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
      attack.addEffectNotes();
    }

    // Add to list
    shared.chatAttacks.push(attack);

    // Add a reference to the attack that created this chat attack
    atk.chatAttack = attack;
  }

  // Cleanup rollData
  delete shared.rollData.attackCount;
};

/**
 * Adds a ChatAttack entry for damage to an attack's shared context.
 *
 * @param {object} shared - Shared data between attack functions.
 */
export const addDamage = async function (shared) {
  // Set conditional modifiers
  shared.conditionalParts = {
    "damage.normal": shared.conditionalPartsCommon["damage.allDamage.normal"] ?? [],
  };

  const attack = new ChatAttack(shared.action, { rollData: shared.rollData, primaryAttack: shared.primaryAttack });
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
 * @param {object} shared - Shared data between attack functions.
 */
export const addEffectNotes = async function (shared) {
  const attack = new ChatAttack(shared.action, { rollData: shared.rollData, primaryAttack: shared.primaryAttack });

  // Add effect notes
  attack.addEffectNotes();

  // Add to list
  shared.chatAttacks.push(attack);
};

/**
 * @typedef {object} Attack_MeasureTemplateResult
 * @property {boolean} result - Whether an area was selected.
 * @property {Function} [place] - Function to place the template, if an area was selected.
 * @property {Function} [delete] - Function to delete the template, if it has been placed.
 */
/**
 * Prompts the user for an area, based on the attack's measure template.
 *
 * @param {object} shared - Shared data between attack functions.
 * @returns {Promise.<Attack_MeasureTemplateResult>} Whether an area was selected.
 */
export const promptMeasureTemplate = async function (shared) {
  // Determine size
  let dist = shared.action.data.measureTemplate.size;
  if (typeof dist === "string") {
    dist = RollPF.safeRoll(shared.action.data.measureTemplate.size, shared.rollData).total;
  }
  dist = convertDistance(dist)[0];

  // Create data object
  const templateOptions = {
    type: shared.action.data.measureTemplate.type,
    distance: dist,
  };
  if (shared.action.data.measureTemplate.overrideColor) {
    templateOptions.color = shared.action.data.measureTemplate.customColor;
  }
  if (shared.action.data.measureTemplate.overrideTexture) {
    templateOptions.texture = shared.action.data.measureTemplate.customTexture;
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
 * @param {object} shared - Shared data between attack functions.
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
 * @param {object} shared - Shared data between attack functions.
 */
export const getMessageData = async function (shared) {
  if (shared.chatAttacks.length === 0) return;

  // Create chat template data
  shared.templateData = {
    action: shared.action,
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
  if (shared.action.data.soundEffect) shared.chatData.sound = shared.action.data.soundEffect;
  // Set dice sound if neither attack sound nor Dice so Nice are available
  else if (game.dice3d == null || !game.dice3d.isEnabled()) shared.chatData.sound = CONFIG.sounds.dice;

  // Get extra text
  const props = [];
  let extraText = "";
  if (shared.templateData.attacks.length > 0) extraText = shared.templateData.attacks[0].attackNotesHTML;

  const itemChatData = this.getChatData({ rollData: shared.rollData }, { actionId: shared.action.id });

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
  if (this.system.type === "spell" && this.parent) {
    const clNotes = this.parent.getContextNotesParsed(`spell.cl.${this.system.spellbook}`);

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
  const identified = Boolean(shared.rollData.item?.identified ?? true);
  const name = identified
    ? `${shared.rollData.item.identifiedName || this.name} (${shared.action.name})`
    : shared.rollData.item.unidentified?.name || this.name;
  shared.templateData = mergeObject(
    shared.templateData,
    {
      tokenUuid: token ? token.document?.uuid ?? token.uuid : null,
      actionId: shared.action?.id,
      extraText: extraText,
      identified: identified,
      name: name,
      description: identified ? this.fullDescription : itemChatData.unidentifiedDescription,
      actionDescription: itemChatData.actionDescription,
      hasExtraText: extraText.length > 0,
      properties: props,
      hasProperties: props.length > 0,
      item: this.toObject(),
      actor: this.parentActor,
      hasSave: shared.action.hasSave,
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
    const range = shared.action.range;
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

      const rangeUnits = shared.action.data.range.units;
      if (["melee", "touch", "reach", "close", "medium", "long"].includes(rangeUnits)) {
        shared.templateData.rangeLabel = CONFIG.PF1.distanceUnits[rangeUnits];
      }
    }
  }

  // Add spell info
  if (this.type === "spell" && this.parent != null) {
    // Spell failure
    if (this.parent.spellFailure > 0 && this.system.components.somatic) {
      const spellbook = getProperty(
        this.parentActor.data,
        `system.attributes.spells.spellbooks.${this.system.spellbook}`
      );
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
          actorData: o.actor?.toObject(false),
          tokenData: o.document?.toObject(false),
          uuid: o.document.uuid,
        };
      });
    }
  }

  shared.chatData["flags.pf1.metadata"] = metadata;
  shared.chatData["flags.core.canPopout"] = true;
  if (!identified)
    shared.chatData["flags.pf1.identifiedInfo"] = {
      identified,
      name: this.name,
      description: itemChatData.identifiedDescription,
      actionName: shared.action.name,
      actionDescription: itemChatData.actionDescription,
    };
};

/**
 * Adds generic property labels to an attack's chat card.
 *
 * @param {object} shared - Shared data between attack functions.
 * @returns {string[]} The resulting property labels.
 */
export const addGenericPropertyLabels = function (shared) {
  const properties = [];

  // Add actual cost
  const cost = shared.rollData.chargeCost;
  if (cost && !this.system.atWill) {
    if (this.system.type === "spell" && this.useSpellPoints()) {
      properties.push(`${game.i18n.localize("PF1.SpellPointsCost")}: ${cost}`);
    } else {
      properties.push(`${game.i18n.localize("PF1.ChargeCost")}: ${cost}`);
    }
  }

  // Add info for broken state
  if (this.system.broken) {
    properties.push(game.i18n.localize("PF1.Broken"));
  }

  // Nonlethal
  if (this.system.nonlethal) properties.push(game.i18n.localize("PF1.Nonlethal"));

  // Add info for Power Attack to melee, Deadly Aim to ranged attacks
  if (shared.powerAttack) {
    if (this.system.actionType === "rwak") properties.push(game.i18n.localize("PF1.DeadlyAim"));
    if (this.system.actionType === "mwak") properties.push(game.i18n.localize("PF1.PowerAttack"));
  }

  // Add info for Point-Blank shot
  if (shared.pointBlankShot) properties.push(game.i18n.localize("PF1.PointBlankShot"));

  // Add info for Rapid Shot
  if (shared.attacks.find((o) => o.id === "rapid-shot")) properties.push(game.i18n.localize("PF1.RapidShot"));

  if (shared.manyShot) properties.push(game.i18n.localize("PF1.Manyshot"));

  // Add Armor Check Penalty's application to attack rolls info
  if (this.hasAttack && shared.rollData.attributes.acp.attackPenalty > 0)
    properties.push(game.i18n.localize("PF1.ArmorCheckPenalty"));

  // Add conditionals info
  if (shared.conditionals?.length) {
    shared.conditionals.forEach((c) => {
      properties.push(shared.action.data.conditionals[c].name);
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
 * @param {object} shared - Shared data between attack functions.
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
 * @param {object} shared - Shared data between attack functions.
 * @returns {object} The resulting metadata object.
 */
export const generateChatMetadata = function (shared) {
  const metadata = {};

  metadata.item = this.id;
  metadata.template = shared.template ? shared.template.id : null;
  metadata.rolls = {
    attacks: {},
  };

  // Get template for later variables
  const template = canvas.scene ? canvas.templates.get(metadata.template) : null;

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
  if (shared.saveDC) metadata.save = { dc: shared.saveDC, type: shared.save };
  if (this.type === "spell") metadata.spell = { cl: shared.rollData.cl, sl: shared.rollData.sl };

  return metadata;
};

/**
 * Executes the item's script calls.
 *
 * @param {object} shared - Shared data between attack functions.
 * @returns {object} The resulting data from the script calls.
 */
export const executeScriptCalls = async function (shared) {
  // Extra options for script call
  const attackData = shared;

  // Deprecated for V10
  const actorName = this.parentActor.name;
  const itemName = this.name;
  const deprecationWarning = function (propName, newName) {
    console.warn(
      `${actorName}'s ${itemName} is using the deprecated "${propName}". Use "${
        newName ? newName : "shared.attackData." + propName
      }" instead.`
    );
  };
  const handlerMaker = function (propName, redirect) {
    return {
      get(obj, prop) {
        if (prop == "chatMessage" || prop == "fullAttack")
          deprecationWarning("system." + prop, "shared.attackData." + prop);
        else deprecationWarning(propName, redirect);
        return Reflect.get(...arguments);
      },
      set(obj, prop, value) {
        if (prop == "chatMessage" || prop == "fullAttack")
          deprecationWarning("system." + prop, "shared.attackData." + prop);
        else deprecationWarning(propName, redirect);
        return Reflect.set(...arguments);
      },
    };
  };
  // End deprecated

  // Execute script call
  shared.scriptData = await this.executeScriptCalls("use", {
    attackData,
    // Deprecated for V10
    // data: new Proxy({ chatMessage: shared.chatMessage, fullAttack: shared.fullAttack }, handlerMaker("system.)),
    // attacks: new Proxy(shared.chatAttacks ?? [], handlerMaker("attacks", "shared.attackData.chatAttacks")),
    // template: new Proxy(shared.template ?? {}, handlerMaker("template")),
    // End deprecated
  });
};

/**
 * Posts the attack's chat card.
 *
 * @param {object} shared - Shared data between attack functions.
 */
export const postMessage = async function (shared) {
  Hooks.call("itemUse", this, "postAttack", {
    ev: shared.event,
    skipDialog: shared.skipDialog,
    chatData: shared.chatData,
    templateData: shared.templateData,
  });

  // Create message
  const template = "systems/pf1/templates/chat/attack-roll.hbs";
  shared.templateData.damageTypes = game.pf1.damageTypes.toRecord();

  // Show chat message
  let result;
  if (shared.chatAttacks.length > 0) {
    if (shared.chatMessage && shared.scriptData.hideChat !== true)
      result = await createCustomChatMessage(template, shared.templateData, shared.chatData);
    else result = { template: template, data: shared.templateData, chatData: shared.chatData };
  } else {
    if (shared.chatMessage && shared.scriptData.hideChat !== true) result = this.roll();
    else result = { descriptionOnly: true };
  }

  return result;
};
