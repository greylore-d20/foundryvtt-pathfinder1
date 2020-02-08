import { DicePF } from "../dice.js";

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
    if (itemData.data.weight != null) {
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
      if (["none", "touch", "personal", "close", "medium", "long"].includes(rng.units) || (rng.value === 0)) {
        rng.value = null;
        rng.long = null;
      }
      labels.range = [rng.value, rng.long ? `/ ${rng.long}` : null, C.distanceUnits[rng.units]].filterJoin(" ");

      // Duration Label
      let dur = data.duration || {};
      if (["inst", "perm", "spec"].includes(dur.units)) dur.value = null;
      labels.duration = [dur.value, C.timePeriods[dur.units]].filterJoin(" ");

      // Recharge Label
      let chg = data.recharge || {};
      labels.recharge = chg.value ? (parseInt(chg.value) === 6 ? `Recharge [6]` : `Recharge [${chg.value}-6]`) : "";
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
      isHealing: this.isHealing,
      hasDamage: this.hasDamage,
      hasEffect: this.hasEffect,
      isVersatile: this.isVersatile,
      hasSave: this.hasSave
    };

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
      }
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
    if (data.range != null) {
      if (data.range.units === "close") dynamicLabels.range = `Range: ${(25 + Math.floor(cl / 2) * 5)}`;
      else if (data.range.units === "medium") dynamicLabels.range = `Range: ${(100 + cl * 10)}`;
      else if (data.range.units === "long") dynamicLabels.range = `Range:  ${(400 + cl * 40)}`;
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
        data.proficient ? "Proficient": "Not Proficient",
      );
    }

    // Ability activation properties
    if ( data.hasOwnProperty("activation") ) {
      props.push(
        labels.target,
        labels.activation,
        dynamicLabels.range,
        labels.duration
      );
    }

    // Add save DC
    if (data.hasOwnProperty("actionType") && data.save.type !== "") {
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
      if (data.uses.maxFormula && data.uses.maxFormula !== "") {
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
    if (rollData.attributes.bab.total !== 0) {
      parts.push("@attributes.bab.total");
    }
    // Add item's enhancement bonus
    if (rollData.item.enh !== 0) {
      parts.push("@item.enh");
    }
    // Subtract energy drain
    if (rollData.attributes.energyDrain != null) {
      parts.push("- {@attributes.energyDrain, 0}kh");
    }
    // Add proficiency penalty
    if ((this.data.type === "weapon") && !itemData.proficient) { parts.push("@item.proficiencyPenalty"); }

    // Define Critical threshold
    let crit = itemData.ability.critRange || 20;

    // Define Roll Data
    const title = `${this.name} - Attack Roll`;

    // Add contextual attack string
    let effectStr = "";
    if (typeof itemData.attackNotes === "string" && itemData.attackNotes.length) {
      effectStr = DicePF.messageRoll({
        actor: this.actor,
        data: rollData,
        msgStr: itemData.attackNotes
      });
    }
    let effectContent = "";
    if (effectStr.length > 0) {
      const effects = effectStr.split(/[\n\r]+/);
      for (let fx of effects) {
        effectContent += `<div class="extra-misc">${fx}</div>`;
      }
    }

    // Call the roll helper utility
    DicePF.d20Roll({
      event: options.event,
      parts: parts,
      actor: this.actor,
      data: rollData,
      title: title,
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      critical: crit,
      takeTwenty: false,
      dialogOptions: {
        width: 400,
        top: options.event ? options.event.clientY - 80 : null,
        left: window.innerWidth - 710
      },
      fastForward: options.fastForward || false,
      extraRolls: options.extraRolls || [],
      chatTemplate: "systems/pf1/templates/chat/roll-ext.html",
      chatTemplateData: { hasExtraText: effectContent.length > 0, extraText: effectContent }
    });
  }

  async rollAttackFull(options={}) {
    const itemData = this.data.data;
    const actorData = this.actor.data.data;
    const rollData = duplicate(actorData);
    rollData.item = duplicate(itemData);

    options.extraRolls = options.extraRolls || [];

    const attackParts = this.data.data.attackParts;
    for (let part of Object.values(attackParts)) {
      const formula = part[0];
      let bonus = 0;
      if (formula !== "") {
        const roll = new Roll(formula, rollData).roll();
        bonus = roll.total;
      }

      options.extraRolls.push({ bonus: bonus, label: part[1] });
    }

    return this.rollAttack(options);
  }

  /* -------------------------------------------- */

  // Only roll the item's effect
  async rollEffect({event}={}) {
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
    if (event.ctrlKey) rollData.critMult = this.data.data.ability.critMult;
    // Determine ability multiplier
    if (this.data.data.ability.damageMult != null) rollData.ablMult = this.data.data.ability.damageMult;

    // Create effect string
    let effectStr = "";
    if (typeof itemData.effectNotes === "string" && itemData.effectNotes.length) {
      effectStr = DicePF.messageRoll({
        actor: this.actor,
        data: rollData,
        msgStr: itemData.effectNotes
      });
    }
    let effectContent = "";
    if (effectStr.length > 0) {
      const effects = effectStr.split(/[\n\r]+/);
      for (let fx of effects) {
        effectContent += `<div class="extra-effect">${fx}</div>`;
      }
    }

    // Create chat data
    let rollMode = game.settings.get("core", "rollMode");
    let chatData = {
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.CHAT,
      rollMode: game.settings.get("core", "rollMode"),
      sound: CONFIG.sounds.dice,
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      flavor: this.name,
      rollMode: rollMode,
      content: effectContent
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

  /**
   * Place a damage roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.damageRoll logic for the core implementation
   */
  rollDamage({event}={}) {
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
    if (event.ctrlKey) rollData.critMult = this.data.data.ability.critMult;
    // Determine ability multiplier
    if (this.data.data.ability.damageMult != null) rollData.ablMult = this.data.data.ability.damageMult;

    // Define Roll parts
    let parts = itemData.damage.parts.map(d => d[0]);

    // Determine ability score modifier
    let abl = itemData.ability.damage;
    if (abl != null && abl !== "") {
      rollData.extraDamage = Math.floor(Math.max(
        actorData.abilities[itemData.ability.damage].mod * itemData.ability.damageMult,
        actorData.abilities[itemData.ability.damage].mod
      ));
      if (rollData.extraDamage < 0) parts.push("@extraDamage");
      else parts.push("@extraDamage * @critMult");
    }
    // Add enhancement bonus
    if (rollData.item.enh != null && rollData.item.enh !== 0) {
      parts.push("@item.enh * @critMult");
    }

    // Add general damage
    if (rollData.attributes.damage.general !== 0) parts.push("@attributes.damage.general * @critMult");
    // Add melee or spell damage
    if (rollData.attributes.damage.weapon !== 0 && ["mwak", "rwak"].includes(itemData.actionType)) {
      parts.push("@attributes.damage.weapon * @critMult");
    }
    else if (rollData.attributes.damage.spell !== 0 && ["msak", "rsak", "spellsave"].includes(itemData.actionType)) {
      parts.push("@attributes.damage.spell * @critMult");
    }

    // Add contextual attack string
    let effectStr = "";
    if (typeof itemData.effectNotes === "string" && itemData.effectNotes.length) {
      effectStr = DicePF.messageRoll({
        actor: this.actor,
        data: rollData,
        msgStr: itemData.effectNotes
      });
    }
    let effectContent = "";
    if (effectStr.length > 0) {
      const effects = effectStr.split(/[\n\r]+/);
      for (let fx of effects) {
        effectContent += `<div class="extra-misc">${fx}</div>`;
      }
    }

    // Define Roll Data
    let title = `${this.name} - Damage`;
    if (this.isHealing) title = `${this.name} - Healing`;
    const flavor = this.labels.damageTypes.length ? `${title} (${this.labels.damageTypes})` : title;

    // Call the roll helper utility
    DicePF.damageRoll({
      event: event,
      parts: parts,
      actor: this.actor,
      data: rollData,
      title: title,
      flavor: flavor,
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      dialogOptions: {
        width: 400,
        top: event ? event.clientY - 80 : null,
        left: window.innerWidth - 710
      },
      chatTemplate: "systems/pf1/templates/chat/roll-ext.html",
      chatTemplateData: { hasExtraText: effectContent.length > 0, extraText: effectContent }
    });
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
        actor: this.actor,
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

    // Deduct consumed charges from the item
    if ( itemData.uses.autoUse ) {
      let q = itemData.quantity;
      let c = itemData.uses.value;

      // Deduct an item quantity
      if ( c <= 1 && q > 1 ) {
        this.actor.updateOwnedItem({
          id: this.data.id,
          'data.quantity': Math.max(q - 1, 0),
          'data.uses.value': itemData.uses.max
        }, true);
      }

      // Optionally destroy the item
      else if ( c <= 1 && q <= 1 && itemData.uses.autoDestroy ) {
        this.actor.deleteOwnedItem(this.data.id);
      }

      // Deduct the remaining charges
      else {
        this.actor.updateOwnedItem({id: this.data.id, 'data.uses.value': Math.max(c - 1, 0)});
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Perform an ability recharge test for an item which uses the d6 recharge mechanic
   * @prarm {Object} options
   */
  async rollRecharge(options={}) {
    const data = this.data.data;
    if ( !data.recharge.value ) return;

    // Roll the check
    const roll = new Roll("1d6").roll();
    const success = roll.total >= parseInt(data.recharge.value);

    // Display a Chat Message
    const rollMode = game.settings.get("core", "rollMode");
    const chatData = {
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      flavor: `${this.name} recharge check - ${success ? "success!" : "failure!"}`,
      whisper: ( ["gmroll", "blindroll"].includes(rollMode) ) ? ChatMessage.getWhisperIDs("GM") : null,
      blind: rollMode === "blindroll",
      roll: roll,
      speaker: {
        actor: this.actor._id,
        token: this.actor.token,
        alias: this.actor.name
      }
    };

    // Update the Item data
    const promises = [ChatMessage.create(chatData)];
    if ( success ) promises.push(this.update({"data.recharge.charged": true}));
    return Promise.all(promises);
  }

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
    if ( action === "attack" ) await item.rollAttack({event: event, fastForward: true});
    else if (action === "attack-full") await item.rollAttackFull({event: event, fastForward: true});
    else if (action === "damage") await item.rollDamage({event: event, fastForward: true});
    else if (action === "effect") await item.rollEffect({event: event, fastForward: true});
    else if (action === "formula") await item.rollFormula({event: event, fastForward: true});

    // Saving Throws for card targets
    else if ( action === "save" ) {
      for ( let t of targets ) {
        await t.rollAbilitySave(button.dataset.ability, {event});
      }
    }

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
