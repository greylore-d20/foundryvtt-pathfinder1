import { DicePF } from "../dice.js";
import { createCustomChatMessage } from "../chat.js";
import { alterRoll, isMinimumCoreVersion } from "../lib.js";

/**
 * Override and extend the basic :class:`Item` implementation
 */
export class ItemPF extends Item {

  /* -------------------------------------------- */
  /*  Item Properties                             */
  /* -------------------------------------------- */

  /**
   * Does the Item implement an attack roll as part of its usage
   * @type {boolean}
   */
  get hasAttack() {
    return ["mwak", "rwak", "msak", "rsak"].includes(this.data.data.actionType);
  }

  get hasMultiAttack() {
    return this.hasAttack && this.data.data.attackParts != null && this.data.data.attackParts.length > 0;
  }

  get hasAction() {
    return this.hasAttack || this.hasDamage || this.hasEffect;
  }

  /* -------------------------------------------- */

  /**
   * Does the Item implement a damage roll as part of its usage
   * @type {boolean}
   */
  get hasDamage() {
    return !!(this.data.data.damage && this.data.data.damage.parts.length);
  }

  /* -------------------------------------------- */

  /**
   * Does the item provide an amount of healing instead of conventional damage?
   * @return {boolean}
   */
  get isHealing() {
    return (this.data.data.actionType === "heal") && this.data.data.damage.parts.length;
  }

  get hasEffect() {
    return this.hasDamage || (this.data.data.effectNotes && this.data.data.effectNotes.length > 0);
  }

  /* -------------------------------------------- */

  /**
   * Does the Item implement a saving throw as part of its usage
   * @type {boolean}
   */
  get hasSave() {
    return !!(this.data.data.save && this.data.data.save.ability);
  }

  /* -------------------------------------------- */
  /*	Data Preparation														*/
  /* -------------------------------------------- */

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    const itemData = this.data;
    const actorData = this.actor ? this.actor.data : {};
    const data = itemData.data;
    const C = CONFIG.PF1;
    const labels = {};

    // Physical items
    if (hasProperty(itemData, "data.weight")) {
      itemData.data.hp = itemData.data.hp || { max: 10, value: 10 };
      itemData.data.hardness = itemData.data.hardness || 0;
      itemData.data.carried = itemData.data.carried == null ? true : itemData.data.carried;

      // Equipped or carried label
      labels.equipped = "";
      if (itemData.data.equipped === true) labels.equipped = "Equipped";
      else if (itemData.data.carried === true) labels.equipped = "Carried";

      // Slot label
      if (itemData.data.slot) labels.slot = CONFIG.PF1.equipmentSlots[itemData.data.slot];
    }

    // Spell Level,  School, and Components
    if ( itemData.type === "spell" ) {
      labels.level = C.spellLevels[data.level];
      labels.school = C.spellSchools[data.school];
      labels.components = Object.entries(data.components).map(c => {
        c[1] === true ? c[0].titleCase().slice(0,1) : null
      }).filterJoin(",");
    }

    // Feat Items
    else if ( itemData.type === "feat" ) {
      labels.featType = C.featTypes[data.featType];
    }

    // Buff Items
    else if (itemData.type === "buff") {
      labels.buffType = C.buffTypes[data.buffType];
    }

    // Equipment Items
    else if ( itemData.type === "equipment" ) {
      labels.armor = data.armor.value ? `${data.armor.value} AC` : "";
      if (data.armor.dex === "") data.armor.dex = null;
      else if (typeof data.armor.dex === "string" && /\d+/.test(data.armor.dex)) {
        data.armor.dex = parseInt(data.armor.dex);
      }
      // Add enhancement bonus
      if (data.armor.enh == null) data.armor.enh = 0;
    }

    // Activated Items
    if ( data.hasOwnProperty("activation") ) {

      // Ability Activation Label
      let act = data.activation || {};
      if (act) labels.activation = [["minute", "hour"].includes(act.type) ? act.cost.toString() : "", C.abilityActivationTypes[act.type]].filterJoin(" ");

      // Target Label
      let tgt = data.target || {};
      if (["none", "touch", "personal"].includes(tgt.units)) tgt.value = null;
      if (["none", "personal"].includes(tgt.type)) {
        tgt.value = null;
        tgt.units = null;
      }
      labels.target = [tgt.value, C.distanceUnits[tgt.units], C.targetTypes[tgt.type]].filterJoin(" ");

      // Range Label
      let rng = data.range || {};
      if (!["ft", "mi", "spec"].includes(rng.units)) {
        rng.value = null;
        rng.long = null;
      }
      labels.range = [rng.value, rng.long ? `/ ${rng.long}` : null, C.distanceUnits[rng.units]].filterJoin(" ");
      if (labels.range.length > 0) labels.range = ["Range:", labels.range].join(" ");

      // Duration Label
      let dur = data.duration || {};
      if (["inst", "perm", "spec"].includes(dur.units)) dur.value = null;
      labels.duration = [dur.value, C.timePeriods[dur.units]].filterJoin(" ");
    }

    // Item Actions
    if ( data.hasOwnProperty("actionType") ) {
      // Save DC
      let save = data.save || {};
      labels.save = save.ability ? `DC ${save.dc || ""} ${C.savingThrows[save.type]}` : "";

      // Damage
      let dam = data.damage || {};
      if ( dam.parts ) {
        labels.damage = dam.parts.map(d => d[0]).join(" + ").replace(/\+ -/g, "- ");
        labels.damageTypes = dam.parts.map(d => d[1]).join(", ");
      }

      // Add attack parts
      if (!data.attack) data.attack = { parts: [] };
    }

    this.updateDirectData();

    // Assign labels and return the Item
    this.labels = labels;
  }

  /* -------------------------------------------- */

  /**
   * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
   * @return {Promise}
   */
  async roll() {
    const actor = this.actor;
    if (actor && !actor.hasPerm(game.user, "OWNER")) return ui.notifications.warn("You don't have permission to control this actor");

    // Basic template rendering data
    const token = this.actor.token;
    const templateData = {
      actor: this.actor,
      tokenId: token ? `${token.scene._id}.${token.id}` : null,
      item: this.data,
      data: this.getChatData(),
      labels: this.labels,
      hasAttack: this.hasAttack,
      hasMultiAttack: this.hasMultiAttack,
      hasAction: this.hasAction,
      isHealing: this.isHealing,
      hasDamage: this.hasDamage,
      hasEffect: this.hasEffect,
      isVersatile: this.isVersatile,
      hasSave: this.hasSave,
      isSpell: this.data.type === "spell",
    };

    // Roll spell failure chance
    if (templateData.isSpell && this.actor != null && this.actor.spellFailure > 0) {
      templateData.spellFailure = new Roll("1d100").roll().total;
      templateData.spellFailureSuccess = templateData.spellFailure > this.actor.spellFailure;
    }

    // Render the chat card template
    const templateType = ["consumable"].includes(this.data.type) ? this.data.type : "item";
    const template = `systems/pf1/templates/chat/${templateType}-card.html`;
    const html = await renderTemplate(template, templateData);

    // Basic chat message data
    const chatData = {
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content: html,
      speaker: {
        actor: this.actor._id,
        token: this.actor.token,
        alias: this.actor.name
      },
    };

    // Toggle default roll mode
    let rollMode = game.settings.get("core", "rollMode");
    if ( ["gmroll", "blindroll"].includes(rollMode) ) chatData["whisper"] = ChatMessage.getWhisperIDs("GM");
    if ( rollMode === "blindroll" ) chatData["blind"] = true;

    // Create the chat message
    return ChatMessage.create(chatData, {displaySheet: false});
  }

  /* -------------------------------------------- */
  /*  Chat Cards																	*/
  /* -------------------------------------------- */

  getChatData(htmlOptions) {
    const data = duplicate(this.data.data);
    const labels = this.labels;

    const actorData = this.actor ? this.actor.data.data : {};
    const rollData = duplicate(actorData);
    rollData.item = data;

    // Get the spell specific info
    let spellbookIndex, spellAbility, ablMod = 0;
    let cl = 0;
    let sl = 0;
    if (this.type === "spell") {
      spellbookIndex = data.spellbook;
      spellAbility = this.actor.data.data.attributes.spells.spellbooks[spellbookIndex].ability;
      if (spellAbility !== "") ablMod = this.actor.data.data.abilities[spellAbility].mod;

      cl += this.actor.data.data.attributes.spells.spellbooks[spellbookIndex].cl.total;
      cl += data.clOffset || 0;

      sl += data.level;
      sl += data.slOffset || 0;

      rollData.cl = cl;
      rollData.sl = sl;
    }

    // Gather dynamic labels
    const dynamicLabels = {};
    dynamicLabels.range = labels.range || "";
    dynamicLabels.level = labels.sl || "";
    // Range
    if (data.range != null) {
      if (data.range.units === "close") dynamicLabels.range = `Range: ${(25 + Math.floor(cl / 2) * 5)}`;
      else if (data.range.units === "medium") dynamicLabels.range = `Range: ${(100 + cl * 10)}`;
      else if (data.range.units === "long") dynamicLabels.range = `Range:  ${(400 + cl * 40)}`;
      else if (["ft", "mi", "spec"].includes(data.range.units) && typeof data.range.value === "string") {
        let range = new Roll(data.range.value.length > 0 ? data.range.value : "0", rollData).roll().total;
        dynamicLabels.range = [range > 0 ? "Range:" : null, range, CONFIG.PF1.distanceUnits[data.range.units]].filterJoin(" ");
      }
    }
    // Duration
    if (data.duration != null) {
      if (!["inst", "perm"].includes(data.duration.units) && typeof data.duration.value === "string") {
        let duration = new Roll(data.duration.value.length > 0 ? data.duration.value : "0", rollData).roll().total;
        dynamicLabels.duration = [duration, CONFIG.PF1.timePeriods[data.duration.units]].filterJoin(" ");
      }
    }

    // Rich text description
    data.description.value = TextEditor.enrichHTML(data.description.value, htmlOptions);

    // Item type specific properties
    const props = [];
    const fn = this[`_${this.data.type}ChatData`];
    if ( fn ) fn.bind(this)(data, labels, props);

    // General equipment properties
    if ( data.hasOwnProperty("equipped") && ["weapon", "equipment"].includes(this.data.type) ) {
      props.push(
        data.equipped ? "Equipped" : "Not Equipped",
      );
    }

    // Ability activation properties
    if ( data.hasOwnProperty("activation") ) {
      props.push(
        labels.target,
        labels.activation,
        dynamicLabels.range,
        dynamicLabels.duration
      );
    }

    // Add save DC
    if (data.hasOwnProperty("actionType") && hasProperty(data, "save.type") && data.save.type !== "") {
      let saveDC = new Roll(data.save.dc.length > 0 ? data.save.dc : "0", rollData).roll().total;
      let saveType = CONFIG.PF1.savingThrows[data.save.type];
      if (this.type === "spell") {
        saveDC += 10;
        // Add spellbook's ability modifier
        saveDC += ablMod;
        // Add spell level
        saveDC += sl;
      }
      if (saveDC > 0) {
        props.push(
          `DC ${saveDC} ${saveType}`
        );
      }
    }

    // Add SR reminder
    if (this.type === "spell") {
      if (data.sr) {
        props.push("Spell Resistance");
      }
    }

    // Filter properties and return
    data.properties = props.filter(p => !!p);
    return data;
  }

  updateDirectData() {
    const data = this.data.data;
    const updateData = {};

    // Max uses
    if (data.hasOwnProperty("activation")) {
      if (hasProperty(data, "uses.maxFormula") && data.uses.maxFormula !== "") {
        let roll = new Roll(data.uses.maxFormula, duplicate(this.actor.data.data)).roll();
        if (data.uses.max !== roll.total) {
          updateData["data.uses.max"] = roll.total;
        }
      }
    }

    if (Object.keys(updateData).length > 0 && this.hasPerm(game.user, "OWNER")) {
      this.update(updateData);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare chat card data for equipment type items
   * @private
   */
  _equipmentChatData(data, labels, props) {
    props.push(
      CONFIG.PF1.armorTypes[data.armor.type],
      labels.armor || null,
    );
  }

  /* -------------------------------------------- */

  /**
   * Prepare chat card data for weapon type items
   * @private
   */
  _weaponChatData(data, labels, props) {
    props.push(
      CONFIG.PF1.weaponTypes[data.weaponType],
    );
  }

  /* -------------------------------------------- */

  /**
   * Prepare chat card data for consumable type items
   * @private
   */
  _consumableChatData(data, labels, props) {
    props.push(
      CONFIG.PF1.consumableTypes[data.consumableType]
    );
    if (["day", "week", "charges"].includes(data.uses.per)) {
      props.push(data.uses.value + "/" + data.uses.max + " Charges");
    }
    else props.push(CONFIG.PF1.limitedUsePeriods[data.uses.per]);
    data.hasCharges = data.uses.value >= 0;
  }

  /* -------------------------------------------- */

  /**
   * Prepare chat card data for tool type items
   * @private
   */
  _lootChatData(data, labels, props) {
    props.push(
      data.weight ? data.weight + " lbs." : null
    );
  }

  /* -------------------------------------------- */

  /**
   * Render a chat card for Spell type data
   * @return {Object}
   * @private
   */
  _spellChatData(data, labels, props) {
    const ad = this.actor.data.data;

    // Spell saving throw text
    // const abl = data.ability || ad.attributes.spellcasting || "int";
    // if ( this.hasSave && !data.save.dc ) data.save.dc = 8 + ad.abilities[abl].mod + ad.attributes.prof;
    // labels.save = `DC ${data.save.dc} ${CONFIG.PF1.abilities[data.save.ability]}`;

    // Spell properties
    props.push(
      labels.level,
      labels.components,
    );
  }

  /* -------------------------------------------- */

  /**
   * Prepare chat card data for items of the "Feat" type
   */
  _featChatData(data, labels, props) {
    const ad = this.actor.data.data;

    // Spell saving throw text
    // const abl = data.ability || ad.attributes.spellcasting || "str";
    // if ( this.hasSave && !data.save.dc ) data.save.dc = 8 + ad.abilities[abl].mod + ad.attributes.prof;
    // labels.save = `DC ${data.save.dc} ${CONFIG.PF1.abilities[data.save.ability]}`;

    // Feat properties
    props.push(
      CONFIG.PF1.featTypes[data.featType]
    );
  }

  /* -------------------------------------------- */
  /*  Item Rolls - Attack, Damage, Saves, Checks  */
  /* -------------------------------------------- */

  async useAttack() {
    const actor = this.actor;
    if (actor && !actor.hasPerm(game.user, "OWNER")) return ui.notifications.warn("You don't have permission to control this actor");
    const itemData = this.data.data;
    const actorData = this.actor.data.data;
    const rollData = duplicate(actorData);
    rollData.item = duplicate(itemData);

    // Add contextual attack string
    let props = [];
    let effectStr = "";
    if (typeof itemData.attackNotes === "string" && itemData.attackNotes.length) {
      if (isMinimumCoreVersion("0.5.2")) effectStr = TextEditor.enrichHTML(itemData.attackNotes, { rollData: rollData });
      else {
        effectStr = DicePF.messageRoll({
          data: rollData,
          msgStr: itemData.attackNotes
        });
      }
    }
    let effectContent = "";
    if (effectStr.length > 0) {
      const effects = effectStr.split(/[\n\r]+/);
      for (let fx of effects) {
        effectContent += `<div class="extra-misc">${fx}</div>`;
      }
      effectContent = `<div><label>Attack Notes</label>${effectContent}</div>`;
    }
    if (this.hasEffect) {
      let effectStr = this.rollEffect();
      if (effectStr.length > 0) {
        effectContent += `<div><label>Effect Notes</label>${effectStr}</div>`;
      }
    }

    const properties = this.getChatData().properties;
    if (properties.length > 0) props.push({ header: "Info", value: properties });

    // Define Critical threshold
    let crit = itemData.ability.critRange || 20;

    // Prepare the chat message data
    let chatTemplateData = {
      hasProperties: properties.length > 0,
      properties: props,
      name: this.name,
    };
    // Create attacks
    const allAttacks = this.data.data.attackParts.reduce((cur, r) => {
      cur.push({ bonus: r[0], label: r[1] });
      return cur;
    }, [{ bonus: "", label: "Attack 1" }]);
    let attacks = [];
    const damageTypes = this.data.data.damage.parts.reduce((cur, o) => {
      if (o[1] !== "" && cur.indexOf(o[1]) === -1) cur.push(o[1]);
      return cur;
    }, []);
    if (this.hasAttack) {
      for (let atk of allAttacks) {
        const attack = {};
        let tooltip, roll, d20, flavor, critType = 0;
        // Attack roll
        if (this.hasAttack) {
          roll = this.rollAttack({ bonus: atk.bonus !== "" ? atk.bonus : null });
          d20 = roll.parts[0];
          if (d20.total >= crit) critType = 1;
          else if (d20.total <= 1) critType = 2;

          tooltip = $(await roll.getTooltip()).prepend(`<div class="dice-formula">${roll.formula}</div>`)[0].outerHTML;
          attack.attack = {
            flavor: atk.label,
            tooltip: tooltip,
            total: roll.total,
            isCrit: critType === 1,
            isFumble: critType === 2,
          };

          // Critical hit confirmation
          if (critType === 1) {
            let extraParts = [];
            if (this.data.data.critConfirmBonus != null && this.data.data.critConfirmBonus !== "") extraParts.push(this.data.data.critConfirmBonus);
            roll = this.rollAttack({
              bonus: atk.bonus !== "" ? atk.bonus : null,
              extraParts: extraParts,
            });

            tooltip = $(await roll.getTooltip()).prepend(`<div class="dice-formula">${roll.formula}</div>`)[0].outerHTML;
            attack.critConfirm = {
              flavor: "Critical Confirmation",
              tooltip: tooltip,
              total: roll.total,
            };
          }
        }
        // Add damage
        if (this.hasDamage) {
          roll = this.rollDamage();
          tooltip = $(await roll.getTooltip()).prepend(`<div class="dice-formula">${roll.formula}</div>`)[0].outerHTML;
          flavor = this.isHealing ? "Healing" : "Damage";
          attack.damage = {
            flavor: damageTypes.length > 0 ? `${flavor} (${damageTypes.join(", ")})` : flavor,
            tooltip: tooltip,
            total: roll.total,
          };

          if (critType === 1) {
            roll = this.rollDamage({ critical: true });
            tooltip = $(await roll.getTooltip()).prepend(`<div class="dice-formula">${roll.formula}</div>`)[0].outerHTML;
            flavor = this.isHealing ? "Critical Healing" : "Critical Damage";
            attack.critDamage = {
              flavor: damageTypes.length > 0 ? `${flavor} (${damageTypes.join(", ")})` : flavor,
              tooltip: tooltip,
              total: roll.total,
            };
          }
        }
        // Add to list
        attacks.push(attack);
      };
    }
    // Add damage only
    else if (this.hasDamage) {
      let roll = this.rollDamage();
      let tooltip = $(await roll.getTooltip()).prepend(`<div class="dice-formula">${roll.formula}</div>`)[0].outerHTML;
      let attack = {};
      let flavor = this.isHealing ? "Healing" : "Damage";
      attack.damage = {
        flavor: damageTypes.length > 0 ? `${flavor} (${damageTypes.join(", ")})` : flavor,
        tooltip: tooltip,
        total: roll.total,
      };
      attacks.push(attack);
    }

    for (let a = 0; a < attacks.length || (attacks.length === 0 && a < 1); a++) {
      if (attacks.length > 0) {
        const atk = attacks[a];
        chatTemplateData.attacks = [atk];
      }
      const chatData = {
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
      };

      // Don't play multiple sounds
      if (a > 0) chatData.sound = null;

      // Add effect text
      if (effectContent.length > 0) {
        chatTemplateData.hasExtraText = true;
        chatTemplateData.extraText = effectContent;
      }

      // Post message
      if (this.data.type === "spell") await this.roll();
      await createCustomChatMessage("systems/pf1/templates/chat/attack-roll.html", chatTemplateData, chatData);
    }
  }

  /**
   * Place an attack roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.d20Roll logic for the core implementation
   */
  rollAttack(options={}) {
    const itemData = this.data.data;
    const actorData = this.actor.data.data;
    const rollData = duplicate(actorData);
    rollData.item = duplicate(itemData);
    
    if ( !this.hasAttack ) {
      throw new Error("You may not place an Attack Roll with this Item.");
    }

    // Add CL
    if (this.type === "spell") {
      const spellbookIndex = itemData.spellbook;
      const spellbook = this.actor.data.data.attributes.spells.spellbooks[spellbookIndex];
      const cl = spellbook.cl.total + (itemData.clOffset || 0);
      rollData.cl = cl;
    }
    // Determine size bonus
    rollData.sizeBonus = CONFIG.PF1.sizeMods[actorData.traits.size];
    // Add misc bonuses/penalties
    rollData.item.proficiencyPenalty = -4;

    // Determine ability score modifier
    let abl = itemData.ability.attack;

    // Define Roll parts
    let parts = [];
    // Add ability modifier
    if (abl != "") parts.push(`@abilities.${abl}.mod`);
    // Add bonus parts
    if (options.parts != null) parts = parts.concat(options.parts);
    // Add size bonus
    if (rollData.sizeBonus !== 0) parts.push("@sizeBonus");
    // Add attack bonus
    if (itemData.attackBonus !== "") {
      let attackBonus = new Roll(itemData.attackBonus, rollData).roll().total;
      rollData.item.attackBonus = attackBonus.toString();
      parts.push("@item.attackBonus");
    }

    // Add certain attack bonuses
    if (rollData.attributes.attack.general !== 0) {
      parts.push("@attributes.attack.general");
    }
    if (["mwak", "msak"].includes(itemData.actionType) && rollData.attributes.attack.melee !== 0) {
      parts.push("@attributes.attack.melee");
    }
    else if (["rwak", "rsak"].includes(itemData.actionType) && rollData.attributes.attack.ranged !== 0) {
      parts.push("@attributes.attack.ranged");
    }
    // Add BAB
    if (rollData.attributes.bab.total !== 0 && rollData.attributes.bab.total != null) {
      parts.push("@attributes.bab.total");
    }
    // Add item's enhancement bonus
    if (rollData.item.enh !== 0 && rollData.item.enh != null) {
      parts.push("@item.enh");
    }
    // Subtract energy drain
    if (rollData.attributes.energyDrain != null) {
      parts.push("- {@attributes.energyDrain, 0}kh");
    }
    // Add proficiency penalty
    if ((this.data.type === "attack") && !itemData.proficient) { parts.push("@item.proficiencyPenalty"); }
    // Add masterwork bonus
    if (this.data.type === "attack" && itemData.masterwork === true && itemData.enh < 1) {
      rollData.item.masterworkBonus = 1;
      parts.push("@item.masterworkBonus");
    }
    // Add bonus
    if (options.bonus != null) {
      rollData.bonus = options.bonus;
      parts.push("@bonus");
    }
    // Add extra parts
    if (options.extraParts != null) {
      parts = parts.concat(options.extraParts);
    }

    let roll = new Roll(["1d20"].concat(parts).join("+"), rollData).roll();
    return roll;
  }

  /* -------------------------------------------- */

  // Only roll the item's effect
  rollEffect({critical=false}={}) {
    const itemData = this.data.data;
    const actorData = this.actor.data.data;
    const rollData = mergeObject(duplicate(actorData), {
      item: itemData,
      ablMult: 0
    }, { inplace: false });

    if (!this.hasEffect) {
      throw new Error("You may not make an Effect Roll with this Item.");
    }

    // Add CL
    if (this.type === "spell") {
      const spellbookIndex = itemData.spellbook;
      const spellbook = this.actor.data.data.attributes.spells.spellbooks[spellbookIndex];
      const cl = spellbook.cl.total + (itemData.clOffset || 0);
      rollData.cl = cl;
    }

    // Determine critical multiplier
    rollData.critMult = 1;
    if (critical) rollData.critMult = this.data.data.ability.critMult;
    // Determine ability multiplier
    if (this.data.data.ability.damageMult != null) rollData.ablMult = this.data.data.ability.damageMult;

    // Create effect string
    let effectStr = "";
    if (typeof itemData.effectNotes === "string" && itemData.effectNotes.length) {
      if (isMinimumCoreVersion("0.5.2")) effectStr = TextEditor.enrichHTML(itemData.effectNotes, { rollData: rollData });
      else {
        effectStr = DicePF.messageRoll({
          data: rollData,
          msgStr: itemData.effectNotes
        });
      }
    }
    let effectContent = "";
    if (effectStr.length > 0) {
      const effects = effectStr.split(/[\n\r]+/);
      for (let fx of effects) {
        effectContent += `<div class="extra-effect">${fx}</div>`;
      }
    }

    return effectContent;
  }

  /**
   * Place a damage roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.damageRoll logic for the core implementation
   */
  rollDamage({critical=false}={}) {
    const itemData = this.data.data;
    const actorData = this.actor.data.data;
    const rollData = mergeObject(duplicate(actorData), {
      item: itemData,
      extraDamage: 0
    }, { inplace: false });

    if ( !this.hasDamage ) {
      throw new Error("You may not make a Damage Roll with this Item.");
    }

    // Add CL
    if (this.type === "spell") {
      const spellbookIndex = itemData.spellbook;
      const spellbook = this.actor.data.data.attributes.spells.spellbooks[spellbookIndex];
      const cl = spellbook.cl.total + (itemData.clOffset || 0);
      rollData.cl = cl;
    }

    // Determine critical multiplier
    rollData.critMult = 1;
    if (critical) rollData.critMult = this.data.data.ability.critMult;
    // Determine ability multiplier
    if (this.data.data.ability.damageMult != null) rollData.ablMult = this.data.data.ability.damageMult;

    // Define Roll parts
    let parts = itemData.damage.parts.map(d => d[0]);
    parts[0] = alterRoll(parts[0], 0, rollData.critMult);

    // Determine ability score modifier
    let abl = itemData.ability.damage;
    if (abl != null && abl !== "") {
      rollData.extraDamage = Math.floor(actorData.abilities[abl].mod * itemData.ability.damageMult);
      if (actorData.abilities[abl].mod < 0) rollData.extraDamage = actorData.abilities[abl].mod;
      if (rollData.extraDamage < 0) parts.push("@extraDamage");
      else if (rollData.critMult !== 1) parts.push("@extraDamage * @critMult");
      else parts.push("@extraDamage");
    }
    // Add enhancement bonus
    if (rollData.item.enh != null && rollData.item.enh !== 0 && rollData.item.enh != null) {
      if (rollData.critMult !== 1) parts.push("@item.enh * @critMult");
      else parts.push("@item.enh");
    }

    // Add general damage
    if (rollData.attributes.damage.general !== 0) {
      if (rollData.critMult !== 1) parts.push("@attributes.damage.general * @critMult");
      else parts.push("@attributes.damage.general");
    }
    // Add melee or spell damage
    if (rollData.attributes.damage.weapon !== 0 && ["mwak", "rwak"].includes(itemData.actionType)) {
      if (rollData.critMult !== 1) parts.push("@attributes.damage.weapon * @critMult");
      else parts.push("@attributes.damage.weapon");
    }
    else if (rollData.attributes.damage.spell !== 0 && ["msak", "rsak", "spellsave"].includes(itemData.actionType)) {
      if (rollData.critMult !== 1) parts.push("@attributes.damage.spell * @critMult");
      else parts.push("@attributes.damage.spell");
    }

    // Create roll
    const roll = new Roll(parts.join("+"), rollData);

    return roll.roll();
  }

  /* -------------------------------------------- */

  /**
   * Adjust a cantrip damage formula to scale it for higher level characters and monsters
   * @private
   */
  _scaleCantripDamage(parts, level, scale) {
    const add = Math.floor((level + 1) / 6);
    if ( add === 0 ) return;
    if ( scale && (scale !== parts[0]) ) {
      parts[0] = parts[0] + " + " + scale.replace(new RegExp(Roll.diceRgx, "g"), (match, nd, d) => `${add}d${d}`);
    } else {
      parts[0] = parts[0].replace(new RegExp(Roll.diceRgx, "g"), (match, nd, d) => `${parseInt(nd)+add}d${d}`);
    }
  }

  /* -------------------------------------------- */

  /**
   * Place an attack roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.d20Roll logic for the core implementation
   */
  async rollFormula(options={}) {
    const itemData = this.data.data;
    const actorData = this.actor.data.data;
    if ( !itemData.formula ) {
      throw new Error("This Item does not have a formula to roll!");
    }

    // Define Roll Data
    const rollData = duplicate(actorData);
    rollData.item = itemData;
    const title = `${this.name} - Other Formula`;

    const roll = new Roll(itemData.formula, rollData).roll();
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      flavor: itemData.chatFlavor || title,
      rollMode: game.settings.get("core", "rollMode")
    });
  }

  /* -------------------------------------------- */

  /**
   * Use a consumable item
   */
  async rollConsumable(options={}) {
    let itemData = this.data.data;
    const labels = this.labels;
    let parts = itemData.damage.parts;
    const data = duplicate(this.actor.data.data);

    // Add effect string
    let effectStr = "";
    if (typeof itemData.effectNotes === "string" && itemData.effectNotes.length) {
      effectStr = DicePF.messageRoll({
        data: data,
        msgStr: itemData.effectNotes
      });
    }

    parts = parts.map(obj => {
      return obj[0];
    });
    // Submit the roll to chat
    if (effectStr === "") {
      new Roll(parts.join("+")).toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `Uses ${this.name}`
      });
    }
    else {
      const chatTemplate = "systems/pf1/templates/chat/roll-ext.html";
      const chatTemplateData = { hasExtraText: true, extraText: effectStr };
      // Execute the roll
      let roll = new Roll(parts.join("+"), data).roll();

      // Create roll template data
      const rollData = mergeObject({
        user: game.user._id,
        formula: roll.formula,
        tooltip: await roll.getTooltip(),
        total: roll.total,
      }, chatTemplateData || {});

      // Create chat data
      let chatData = {
        user: game.user._id,
        type: CONST.CHAT_MESSAGE_TYPES.CHAT,
        rollMode: game.settings.get("core", "rollMode"),
        sound: CONFIG.sounds.dice,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `Uses ${this.name}`,
        rollMode: game.settings.get("core", "rollMode"),
        roll: roll,
        content: await renderTemplate(chatTemplate, rollData),
      };
      // Handle different roll modes
      switch (chatData.rollMode) {
        case "gmroll":
          chatData["whisper"] = game.users.entities.filter(u => u.isGM).map(u => u._id);
          break;
        case "selfroll":
          chatData["whisper"] = [game.user._id];
          break;
        case "blindroll":
          chatData["whisper"] = game.users.entities.filter(u => u.isGM).map(u => u._id);
          chatData["blind"] = true;
      }

      // Send message
      ChatMessage.create(chatData);
    }
  }

  /* -------------------------------------------- */

  /**
   * @returns {Object} An object with data to be used in rolls in relation to this item.
   */
  getRollData() {
    const result = {};

    if (this.type === "buff") result.level = this.data.data.level;

    return result;
  }

  /* -------------------------------------------- */

  static chatListeners(html) {
    html.on('click', '.card-buttons button', this._onChatCardAction.bind(this));
    html.on('click', '.item-name', this._onChatCardToggleContent.bind(this));
  }

  /* -------------------------------------------- */

  static async _onChatCardAction(event) {
    event.preventDefault();

    // Extract card data
    const button = event.currentTarget;
    button.disabled = true;
    const card = button.closest(".chat-card");
    const messageId = card.closest(".message").dataset.messageId;
    const message =  game.messages.get(messageId);
    const action = button.dataset.action;

    // Validate permission to proceed with the roll
    // const isTargetted = action === "save";
    const isTargetted = false;
    if ( !( isTargetted || game.user.isGM || message.isAuthor ) ) return;

    // Get the Actor from a synthetic Token
    const actor = this._getChatCardActor(card);
    if ( !actor ) return;

    // Get the Item
    const item = actor.getOwnedItem(card.dataset.itemId);

    // Get card targets
    const targets = isTargetted ? this._getChatCardTargets(card) : [];

    // Attack and Damage Rolls
    if ( action === "attack" ) await item.useAttack();

    // Consumable usage
    else if ( action === "consume" ) await item.rollConsumable({event});

    // Re-enable the button
    button.disabled = false;
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the visibility of chat card content when the name is clicked
   * @param {Event} event   The originating click event
   * @private
   */
  static _onChatCardToggleContent(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const card = header.closest(".chat-card");
    const content = card.querySelector(".card-content");
    content.style.display = content.style.display === "none" ? "block" : "none";
  }

  /**
   * Get the Actor which is the author of a chat card
   * @param {HTMLElement} card    The chat card being used
   * @return {Actor|null}         The Actor entity or null
   * @private
   */
  static _getChatCardActor(card) {

    // Case 1 - a synthetic actor from a Token
    const tokenKey = card.dataset.tokenId;
    if (tokenKey) {
      const [sceneId, tokenId] = tokenKey.split(".");
      const scene = game.scenes.get(sceneId);
      if (!scene) return null;
      const tokenData = scene.getEmbeddedEntity("tokens", tokenId);
      if (!tokenData) return null;
      const token = new Token(tokenData);
      return token.actor;
    }

    // Case 2 - use Actor ID directory
    const actorId = card.dataset.actorId;
    return game.actors.get(actorId) || null;
  }

  /* -------------------------------------------- */

  /**
   * Get the Actor which is the author of a chat card
   * @param {HTMLElement} card    The chat card being used
   * @return {Array.<Actor>}      The Actor entity or null
   * @private
   */
  static _getChatCardTargets(card) {
    const character = game.user.character;
    const controlled = canvas.tokens.controlled;
    const targets = controlled.reduce((arr, t) => t.actor ? arr.concat([t.actor]) : arr, []);
    if ( character && (controlled.length === 0) ) targets.push(character);
    if ( !targets.length ) throw new Error(`You must designate a specific Token as the roll target`);
    return targets;
  }
}
