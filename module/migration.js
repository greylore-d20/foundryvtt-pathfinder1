import { ItemPF } from "./item/entity.js";
import { ExperienceConfig } from "./config/experience.js";
import { createTag } from "./lib.js";
import { ItemChange } from "./item/components/change.js";
import { getChangeFlat } from "./actor/apply-changes.js";
import { SemanticVersion } from "./semver.js";

/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 *
 * @returns {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function () {
  if (!game.user.isGM) {
    const msg = game.i18n.localize("PF1.ErrorUnauthorizedAction");
    console.error(msg);
    return ui.notifications.error(msg);
  }
  game.pf1.isMigrating = true;
  ui.notifications.info(game.i18n.format("PF1.Migration.Start", { version: game.system.data.version }), {
    permanent: true,
  });
  console.log("System Migration starting.");

  await _migrateWorldSettings();

  // Migrate World Actors
  console.log("Migrating Actor entities");
  for (let a of game.actors.contents) {
    try {
      const updateData = migrateActorData(a.data);
      if (!foundry.utils.isObjectEmpty(updateData)) {
        console.log(`Migrating Actor entity ${a.name}`);
        await a.update(updateData, { enforceTypes: false });
      }
    } catch (err) {
      console.error(`Error migrating actor entity ${a.name}`, err);
    }
  }

  // Migrate World Items
  console.log("Migrating Item entities.");
  for (let i of game.items.contents) {
    try {
      const updateData = migrateItemData(i.data);
      if (!foundry.utils.isObjectEmpty(updateData)) {
        console.log(`Migrating Item entity ${i.name}`);
        await i.update(updateData, { enforceTypes: false });
      }
    } catch (err) {
      console.error(`Error migrating item entity ${i.name}`, err);
    }
  }

  // Migrate Actor Override Tokens
  console.log("Migrating Scene entities.");
  for (let s of game.scenes.contents) {
    try {
      const updateData = migrateSceneData(s.data);
      if (!foundry.utils.isObjectEmpty(updateData)) {
        console.log(`Migrating Scene entity ${s.name}`);
        await s.update(updateData, { enforceTypes: false });
        // If we do not do this, then synthetic token actors remain in cache
        // with the un-updated actorData.
        s.tokens.contents.forEach((t) => {
          t._actor = null;
        });
      }
    } catch (err) {
      console.error(`Error migrating scene entity ${s.name}`, err);
    }
  }

  // Migrate World Compendium Packs
  const packs = game.packs.filter((p) => {
    return (
      (["world", "pf1"].includes(p.metadata.package) || p.metadata.system === "pf1") &&
      ["Actor", "Item", "Scene"].includes(p.metadata.entity) &&
      !p.locked
    );
  });
  for (let p of packs) {
    await migrateCompendium(p);
  }

  // Set the migration as complete
  game.settings.set("pf1", "systemMigrationVersion", game.system.data.version);
  ui.notifications.active
    .find(
      (o) =>
        o.hasClass("permanent") &&
        o[0].innerText === game.i18n.format("PF1.Migration.Start", { version: game.system.data.version })
    )
    ?.click();
  ui.notifications.info(game.i18n.format("PF1.Migration.End", { version: game.system.data.version }));
  console.log("System Migration completed.");
  game.pf1.isMigrating = false;
  Hooks.callAll("pf1.migrationFinished");
};

/* -------------------------------------------- */

/**
 * Apply migration rules to all Entities within a single Compendium pack
 *
 * @param pack
 * @returns {Promise}
 */
export const migrateCompendium = async function (pack) {
  const entity = pack.metadata.entity;
  if (!["Actor", "Item", "Scene"].includes(entity)) return;

  // Begin by requesting server-side data model migration and get the migrated content
  await pack.migrate();
  const content = await pack.getDocuments();

  // Iterate over compendium entries - applying fine-tuned migration functions
  console.log(`Migrating ${entity} entities in Compendium ${pack.collection}`);
  for (let ent of content) {
    try {
      let updateData = null;
      if (entity === "Item") updateData = migrateItemData(ent.data);
      else if (entity === "Actor") updateData = migrateActorData(ent.data);
      else if (entity === "Scene") updateData = migrateSceneData(ent.data);
      expandObject(updateData);
      updateData["_id"] = ent.id;
      await ent.update(updateData);
      console.log(`Migrated ${entity} entity ${ent.name} in Compendium ${pack.collection}`);
    } catch (err) {
      console.error(`Error migrating ${entity} entity ${ent.name} in Compendium ${pack.collection}`, err);
    }
  }
  console.log(`Migrated all ${entity} entities from Compendium ${pack.collection}`);
};

/**
 * Migrates world settings.
 */
const _migrateWorldSettings = async function () {
  const oldXPTrack = game.settings.get("pf1", "experienceRate");
  if (oldXPTrack !== "" && oldXPTrack != null) {
    // Set new config style
    const config = game.settings.get("pf1", "experienceConfig") || ExperienceConfig.defaultSettings;
    config.track = oldXPTrack;
    await game.settings.set("pf1", "experienceConfig", config);
    // Remove old config style
    await game.settings.set("pf1", "experienceRate", "");
  }
};

/* -------------------------------------------- */
/*  Entity Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate a single Actor entity to incorporate latest data model changes
 * Return an Object of updateData to be applied
 *
 * @param {Actor} actor   The actor data to derive an update from
 * @returns {object}       The updateData to apply
 */
export const migrateActorData = function (actor) {
  const updateData = {};

  _migrateCharacterLevel(actor, updateData);
  _migrateActorEncumbrance(actor, updateData);
  _migrateActorNoteArrays(actor, updateData);
  _migrateActorSpeed(actor, updateData);
  _migrateSpellDivineFocus(actor, updateData);
  _migrateActorSpellbookCL(actor, updateData);
  _migrateActorSpellbookSlots(actor, updateData);
  _migrateActorBaseStats(actor, updateData);
  _migrateActorCreatureType(actor, updateData);
  _migrateActorSpellbookDCFormula(actor, updateData);
  _migrateActorHPAbility(actor, updateData);
  _migrateActorCR(actor, updateData);
  _migrateAttackAbility(actor, updateData);
  _migrateActorDefenseAbility(actor, updateData);
  _migrateActorTokenVision(actor, updateData);
  _migrateActorSpellbookUsage(actor, updateData);
  _migrateActorNullValues(actor, updateData);
  _migrateActorSpellbookDomainSlots(actor, updateData);
  _migrateActorStatures(actor, updateData);
  _migrateActorInitAbility(actor, updateData);
  _migrateActorChangeRevamp(actor, updateData);
  _migrateActorConditions(actor, updateData);

  // Migrate Owned Items
  if (!actor.items) return updateData;
  const items = actor.items.reduce((arr, i) => {
    // Migrate the Owned Item
    const itemData = i instanceof CONFIG.Item.documentClass ? i.toObject() : i;
    let itemUpdate = migrateItemData(itemData);

    // Update the Owned Item
    if (!isObjectEmpty(itemUpdate)) {
      itemUpdate._id = itemData._id;
      arr.push(expandObject(itemUpdate));
    }

    return arr;
  }, []);
  if (items.length > 0) updateData.items = items;
  return updateData;
};

/* -------------------------------------------- */

/**
 * Migrate a single Item entity to incorporate latest data model changes
 *
 * @param {Actor} item   The item data to derive an update from
 * @returns {object}       The updateData to apply
 */
export const migrateItemData = function (item) {
  const updateData = {};

  _migrateItemArrayTypes(item, updateData);
  _migrateItemSpellUses(item, updateData);
  _migrateWeaponDamage(item, updateData);
  _migrateWeaponImprovised(item, updateData);
  _migrateSpellDescription(item, updateData);
  _migrateClassDynamics(item, updateData);
  _migrateClassType(item, updateData);
  _migrateWeaponCategories(item, updateData);
  _migrateEquipmentCategories(item, updateData);
  _migrateWeaponSize(item, updateData);
  _migrateAbilityTypes(item, updateData);
  _migrateClassLevels(item, updateData);
  _migrateSavingThrowTypes(item, updateData);
  _migrateCR(item, updateData);
  _migrateItemChanges(item, updateData);
  _migrateTemplateSize(item, updateData);
  _migrateEquipmentSize(item, updateData);
  _migrateTags(item, updateData);
  _migrateSpellCosts(item, updateData);
  _migrateLootEquip(item, updateData);
  _migrateUnchainedActionEconomy(item, updateData);
  _migrateItemRange(item, updateData);
  _migrateItemLinks(item, updateData);
  _migrateProficiencies(item, updateData);
  _migrateItemNotes(item, updateData);

  // Return the migrated update data
  return updateData;
};

/* -------------------------------------------- */

/**
 * Migrate a single Scene entity to incorporate changes to the data model of it's actor data overrides
 * Return an Object of updateData to be applied
 *
 * @param {object} scene - The Scene to Update
 * @returns {object} The updateData to apply
 */
export const migrateSceneData = function (scene) {
  const tokens = scene.tokens.map((token) => {
    const t = token.toJSON();
    if (!t.actorId || t.actorLink) {
      t.actorData = {};
    } else if (!game.actors.has(t.actorId)) {
      t.actorId = null;
      t.actorData = {};
    } else if (!t.actorLink) {
      const actorData = duplicate(t.actorData);
      actorData.type = token.actor?.type;
      const update = migrateActorData(actorData);
      ["items", "effects"].forEach((embeddedName) => {
        if (!update[embeddedName]?.length) return;
        const updates = new Map(update[embeddedName].map((u) => [u._id, u]));
        t.actorData[embeddedName].forEach((original) => {
          const update = updates.get(original._id);
          if (update) mergeObject(original, update);
        });
        delete update[embeddedName];
      });

      mergeObject(t.actorData, update);
    }
    return t;
  });
  return { tokens };
};

/* -------------------------------------------- */

const _migrateCharacterLevel = function (ent, updateData) {
  const arr = ["details.level.value", "details.level.min", "details.level.max", "details.mythicTier"];
  for (let k of arr) {
    const value = getProperty(ent.data, k);
    if (value == null) {
      updateData["data." + k] = 0;
    }
  }
};

const _migrateActorEncumbrance = function (ent, updateData) {
  const arr = [
    "attributes.encumbrance.level",
    "attributes.encumbrance.levels.light",
    "attributes.encumbrance.levels.medium",
    "attributes.encumbrance.levels.heavy",
    "attributes.encumbrance.levels.carry",
    "attributes.encumbrance.levels.drag",
    "attributes.encumbrance.carriedWeight",
  ];
  for (let k of arr) {
    const value = getProperty(ent.data, k);
    if (value == null) {
      updateData["data." + k] = 0;
    }
  }
};

const _migrateActorNoteArrays = function (ent, updateData) {
  const list = ["data.attributes.acNotes", "data.attributes.cmdNotes", "data.attributes.srNotes"];
  for (let k of list) {
    const value = getProperty(ent, k);
    const hasValue = hasProperty(ent, k);
    if (hasValue && value instanceof Array) {
      updateData[k] = value.join("\n");
    }
  }
};

const _migrateActorSpeed = function (ent, updateData) {
  const arr = [
    "attributes.speed.land",
    "attributes.speed.climb",
    "attributes.speed.swim",
    "attributes.speed.fly",
    "attributes.speed.burrow",
  ];
  for (let k of arr) {
    let value = getProperty(ent.data, k);
    if (typeof value === "string") value = parseInt(value);
    if (typeof value === "number") {
      updateData[`data.${k}.base`] = value;
      updateData[`data.${k}.total`] = value;
    } else if (value == null) {
      updateData[`data.${k}.base`] = 0;
      updateData[`data.${k}.total`] = null;
    }

    // Add maneuverability
    if (k === "attributes.speed.fly" && getProperty(ent.data, `${k}.maneuverability`) === undefined) {
      updateData[`data.${k}.maneuverability`] = "average";
    }
  }
};

const _migrateActorSpellbookSlots = function (ent, updateData) {
  for (let spellbookSlot of Object.keys(getProperty(ent, "data.attributes.spells.spellbooks") || {})) {
    if (getProperty(ent, `data.attributes.spells.spellbooks.${spellbookSlot}.autoSpellLevels`) == null) {
      updateData[`data.attributes.spells.spellbooks.${spellbookSlot}.autoSpellLevels`] = true;
    }

    for (let a = 0; a < 10; a++) {
      const baseKey = `data.attributes.spells.spellbooks.${spellbookSlot}.spells.spell${a}.base`;
      const maxKey = `data.attributes.spells.spellbooks.${spellbookSlot}.spells.spell${a}.max`;
      const base = getProperty(ent, baseKey);
      const max = getProperty(ent, maxKey);
      if (base === undefined && typeof max === "number" && max > 0) {
        updateData[baseKey] = max.toString();
      } else if (base === undefined) {
        updateData[baseKey] = "";
      }
    }
  }
};

const _migrateActorBaseStats = function (ent, updateData) {
  const keys = [
    "data.attributes.hp.base",
    "data.attributes.hd.base",
    "data.attributes.savingThrows.fort.value",
    "data.attributes.savingThrows.ref.value",
    "data.attributes.savingThrows.will.value",
  ];
  for (let k of keys) {
    if (k === "attributes.hp.base" && !(getProperty(ent, "items") || []).filter((o) => o.type === "class").length)
      continue;
    if (getProperty(ent, k) != null) {
      let kList = k.split(".");
      kList[kList.length - 1] = `-=${kList[kList.length - 1]}`;
      updateData[kList.join(".")] = null;
    }
  }
};

const _migrateActorCreatureType = function (ent, updateData) {
  if (getProperty(ent, "data.attributes.creatureType") == null) {
    updateData["data.attributes.creatureType"] = "humanoid";
  }
};

const _migrateActorSpellbookDCFormula = function (ent, updateData) {
  const spellbooks = Object.keys(getProperty(ent, "data.attributes.spells.spellbooks") || {});

  for (let k of spellbooks) {
    const key = `data.attributes.spells.spellbooks.${k}.baseDCFormula`;
    const curFormula = getProperty(ent, key);
    if (curFormula == null) updateData[key] = "10 + @sl + @ablMod";
  }
};

const _migrateActorSpellbookCL = function (ent, updateData) {
  const spellbooks = Object.keys(getProperty(ent, "data.attributes.spells.spellbooks") || {});

  for (let k of spellbooks) {
    const key = `data.attributes.spells.spellbooks.${k}.cl`;
    const curBase = parseInt(getProperty(ent, key + ".base"));
    const curFormula = getProperty(ent, key + ".formula");
    if (curBase > 0) {
      if (curFormula.length > 0) updateData[`${key}.formula`] = curFormula + " + " + curBase;
      else updateData[`${key}.formula`] = curFormula + curBase;
      updateData[`${key}.base`] = 0;
    }
  }
};

const _migrateActorHPAbility = function (ent, updateData) {
  // Set HP ability
  if (getProperty(ent, "data.attributes.hpAbility") === undefined) {
    updateData["data.attributes.hpAbility"] = "con";
  }

  // Set Fortitude save ability
  if (getProperty(ent, "data.attributes.savingThrows.fort.ability") === undefined) {
    updateData["data.attributes.savingThrows.fort.ability"] = "con";
  }

  // Set Reflex save ability
  if (getProperty(ent, "data.attributes.savingThrows.ref.ability") === undefined) {
    updateData["data.attributes.savingThrows.ref.ability"] = "dex";
  }

  // Set Will save ability
  if (getProperty(ent, "data.attributes.savingThrows.will.ability") === undefined) {
    updateData["data.attributes.savingThrows.will.ability"] = "wis";
  }
};

const _migrateItemArrayTypes = function (ent, updateData) {
  const conditionals = getProperty(ent, "data.conditionals");
  if (conditionals != null && !(conditionals instanceof Array)) {
    updateData["data.conditionals"] = [];
  }

  const contextNotes = getProperty(ent, "data.contextNotes");
  if (contextNotes != null && !(contextNotes instanceof Array)) {
    if (contextNotes instanceof Object) updateData["data.contextNotes"] = Object.values(contextNotes);
    else updateData["data.contextNotes"] = [];
  }
};

const _migrateItemSpellUses = function (ent, updateData) {
  if (getProperty(ent.data, "preparation") === undefined) return;

  const value = getProperty(ent.data, "preparation.maxAmount");
  if (typeof value !== "number") updateData["data.preparation.maxAmount"] = 0;
};

const _migrateWeaponDamage = function (ent, updateData) {
  if (ent.type !== "weapon") return;

  const value = getProperty(ent.data, "weaponData");
  if (typeof value !== "object") {
    updateData["data.weaponData"] = {};
    updateData["data.weaponData.critRange"] = 20;
    updateData["data.weaponData.critMult"] = 2;
  }
};

const _migrateWeaponImprovised = function (ent, updateData) {
  if (ent.type !== "weapon") return;

  const value = getProperty(ent.data, "weaponType");
  if (value === "improv") {
    updateData["data.weaponType"] = "misc";
    updateData["data.properties.imp"] = true;
  }
};

const _migrateSpellDescription = function (ent, updateData) {
  if (ent.type !== "spell") return;

  const curValue = getProperty(ent.data, "shortDescription");
  if (curValue != null) return;

  const obj = getProperty(ent.data, "description.value");
  if (typeof obj !== "string") return;
  const html = $(`<div>${obj}</div>`);
  const elem = html.find("h2").next();
  if (elem.length === 1) updateData["data.shortDescription"] = elem.prop("outerHTML");
  else updateData["data.shortDescription"] = html.prop("innerHTML");
};

const _migrateSpellDivineFocus = function (ent, updateData) {
  if (ent.type !== "spell") return;

  const value = getProperty(ent.data, "components.divineFocus");
  if (typeof value === "boolean") updateData["data.components.divineFocus"] = value === true ? 1 : 0;
};

const _migrateClassDynamics = function (ent, updateData) {
  if (ent.type !== "class") return;

  const bab = getProperty(ent.data, "bab");
  if (typeof bab === "number") updateData["data.bab"] = "low";

  const stKeys = ["data.savingThrows.fort.value", "data.savingThrows.ref.value", "data.savingThrows.will.value"];
  for (let key of stKeys) {
    let value = getProperty(ent, key);
    if (typeof value === "number") updateData[key] = "low";
  }
};

const _migrateClassType = function (ent, updateData) {
  if (ent.type !== "class") return;

  if (getProperty(ent.data, "classType") == null) updateData["data.classType"] = "base";
};

const _migrateWeaponCategories = function (ent, updateData) {
  if (ent.type !== "weapon") return;

  // Change category
  const type = getProperty(ent.data, "weaponType");
  if (type === "misc") {
    updateData["data.weaponType"] = "misc";
    updateData["data.weaponSubtype"] = "other";
  } else if (type === "splash") {
    updateData["data.weaponType"] = "misc";
    updateData["data.weaponSubtype"] = "splash";
  }

  const changeProp = ["simple", "martial", "exotic"].includes(type);
  if (changeProp && getProperty(ent.data, "weaponSubtype") == null) {
    updateData["data.weaponSubtype"] = "1h";
  }

  // Change light property
  const lgt = getProperty(ent.data, "properties.lgt");
  if (lgt != null) {
    updateData["data.properties.-=lgt"] = null;
    if (lgt === true && changeProp) {
      updateData["data.weaponSubtype"] = "light";
    }
  }

  // Change two-handed property
  const two = getProperty(ent.data, "properties.two");
  if (two != null) {
    updateData["data.properties.-=two"] = null;
    if (two === true && changeProp) {
      updateData["data.weaponSubtype"] = "2h";
    }
  }

  // Change melee property
  const melee = getProperty(ent.data, "weaponData.isMelee");
  if (melee != null) {
    updateData["data.weaponData.-=isMelee"] = null;
    if (melee === false && changeProp) {
      updateData["data.weaponSubtype"] = "ranged";
    }
  }
};

const _migrateEquipmentCategories = function (ent, updateData) {
  if (ent.type !== "equipment") return;

  const oldType = getProperty(ent.data, "armor.type");
  if (oldType == null) return;

  if (oldType === "clothing") {
    updateData["data.equipmentType"] = "misc";
    updateData["data.equipmentSubtype"] = "clothing";
  } else if (oldType === "shield") {
    updateData["data.equipmentType"] = "shield";
    updateData["data.equipmentSubtype"] = "lightShield";
    updateData["data.slot"] = "shield";
  } else if (oldType === "misc") {
    updateData["data.equipmentType"] = "misc";
    updateData["data.equipmentSubtype"] = "wondrous";
  } else if (["light", "medium", "heavy"].includes(oldType)) {
    updateData["data.equipmentType"] = "armor";
    updateData["data.equipmentSubtype"] = `${oldType}Armor`;
  }

  updateData["data.armor.-=type"] = null;
};

const _migrateWeaponSize = function (ent, updateData) {
  if (ent.type !== "weapon") return;

  if (!getProperty(ent, "data.weaponData.size")) {
    updateData["data.weaponData.size"] = "med";
  }
};

const _migrateAbilityTypes = function (ent, updateData) {
  if (ent.type !== "feat") return;

  if (getProperty(ent, "data.abilityType") == null) {
    updateData["data.abilityType"] = "none";
  }
  // Fix buggy value
  if (getProperty(ent, "data.abilityType") === "n/a") {
    updateData["data.abilityType"] = "none";
  }
};

const _migrateClassLevels = function (ent, updateData) {
  const level = getProperty(ent, "data.levels");
  if (typeof level === "number" && getProperty(ent, "data.level") == null) {
    updateData["data.level"] = level;
    updateData["data.-=levels"] = null;
  }
};

const _migrateSavingThrowTypes = function (ent, updateData) {
  if (getProperty(ent, "data.save.type") == null && typeof getProperty(ent, "data.save.description") === "string") {
    const desc = getProperty(ent, "data.save.description");
    if (desc.match(/REF/i)) updateData["data.save.type"] = "ref";
    else if (desc.match(/FORT/i)) updateData["data.save.type"] = "fort";
    else if (desc.match(/WILL/i)) updateData["data.save.type"] = "will";
  }
};

const _migrateCR = function (ent, updateData) {
  // Migrate CR offset
  const crOffset = getProperty(ent, "data.crOffset");
  if (typeof crOffset === "number") {
    updateData["data.crOffset"] = crOffset.toString();
  }
};

const _migrateItemChanges = function (ent, updateData) {
  // Migrate changes
  const changes = getProperty(ent, "data.changes");
  if (changes != null && changes instanceof Array) {
    let newChanges = [];
    for (let c of changes) {
      if (c instanceof Array) {
        const nc = ItemChange.create(
          {
            formula: c[0],
            target: c[1],
            subTarget: c[2],
            modifier: c[3],
            value: c[4],
          },
          null
        );
        newChanges.push(nc.data);
      } else {
        const nc = ItemChange.create(c, null);
        newChanges.push(nc.data);
      }
    }

    // Alter the changes list
    updateData["data.changes"] = newChanges;
  }

  // Migrate context notes
  const notes = getProperty(ent, "data.contextNotes");
  if (notes != null && notes instanceof Array) {
    let newNotes = [];
    for (let n of notes) {
      if (n instanceof Array) {
        newNotes.push(mergeObject(ItemPF.defaultContextNote, { text: n[0], subTarget: n[2] }, { inplace: false }));
      } else {
        newNotes.push(n);
      }

      // Migrate old note targets
      if (n.target === "spell" && n.subTarget === "effect") {
        n.subTarget = "spellEffect";
      }
    }

    // Alter the context note list
    updateData["data.contextNotes"] = newNotes;
  }
};

const _migrateTemplateSize = function (ent, updateData) {
  const measureSize = getProperty(ent, "data.measureTemplate.size");
  if (typeof measureSize === "number") {
    updateData["data.measureTemplate.size"] = measureSize.toString();
  }
};

const _migrateEquipmentSize = function (ent, updateData) {
  if (ent.type !== "equipment") return;

  const size = getProperty(ent, "data.size");
  if (!size) {
    updateData["data.size"] = "med";
  }
};

const _migrateTags = function (ent, updateData) {
  if (!["class"].includes(ent.type)) return;

  const tag = getProperty(ent, "data.tag");
  if (!tag && ent.name) {
    updateData["data.tag"] = createTag(ent.name);
  }
};

const _migrateSpellCosts = function (ent, updateData) {
  if (ent.type !== "spell") return;

  const spellPointCost = getProperty(ent, "data.spellPoints.cost");
  if (spellPointCost == null) {
    updateData["data.spellPoints.cost"] = "1 + @sl";
  }

  const slotCost = getProperty(ent, "data.slotCost");
  if (slotCost == null) {
    updateData["data.slotCost"] = 1;
  }

  // Migrate level 0 spell charge deduction in a specific version
  if (
    !SemanticVersion.fromString(game.system.data.version).isHigherThan(SemanticVersion.fromString("0.77.11")) &&
    getProperty(ent, "data.level") === 0
  ) {
    updateData["data.preparation.autoDeductCharges"] = false;
  }
};

const _migrateLootEquip = function (ent, updateData) {
  if (ent.type === "loot" && !hasProperty(ent, "equipped")) {
    updateData["data.equipped"] = false;
  }
};

const _migrateUnchainedActionEconomy = function (ent, updateData) {
  // Determine existing data
  const curAction = getProperty(ent, "data.activation");
  const unchainedAction = getProperty(ent, "data.unchainedAction.activation");
  if (!curAction || (curAction && !curAction.type)) return;
  if (unchainedAction && unchainedAction.type) return;

  // Create unchained action economy data
  if (CONFIG.PF1.abilityActivationTypes_unchained[curAction.type] != null) {
    updateData["data.unchainedAction.activation.cost"] = curAction.cost;
    updateData["data.unchainedAction.activation.type"] = curAction.type;
  }
  if (["swift", "attack"].includes(curAction.type)) {
    updateData["data.unchainedAction.activation.cost"] = 1;
    updateData["data.unchainedAction.activation.type"] = "action";
  }
  if (curAction.type === "standard") {
    updateData["data.unchainedAction.activation.cost"] = 2;
    updateData["data.unchainedAction.activation.type"] = "action";
  }
  if (curAction.type === "full" || curAction.type === "round") {
    updateData["data.unchainedAction.activation.cost"] = 3 * (curAction.cost || 1);
    updateData["data.unchainedAction.activation.type"] = "action";
  }
  if (curAction.type === "immediate") {
    updateData["data.unchainedAction.activation.type"] = "reaction";
    updateData["data.unchainedAction.activation.cost"] = 1;
  }
};

const _migrateItemRange = function (ent, updateData) {
  // Set max range increment
  if (getProperty(ent, "data.range.maxIncrements") === undefined) {
    setProperty(updateData, "data.range.maxIncrements", 1);
  }

  if (ent.type === "weapon" && getProperty(ent, "data.weaponData.maxRangeIncrements") === undefined) {
    setProperty(updateData, "data.weaponData.maxRangeIncrements", 1);
  }
};

const _migrateItemLinks = function (ent, updateData) {
  if (["attack", "consumable", "equipment"].includes(ent.type) && !hasProperty(ent, "data.links.charges")) {
    updateData["data.links.charges"] = [];
  }
};

const _migrateProficiencies = function (ent, updateData) {
  // Add proficiency objects to items able to grant proficiencies
  if (["feat", "class", "race"].includes(ent.type)) {
    for (const prof of ["armorProf", "weaponProf"]) {
      if (!hasProperty(ent, `data.${prof}`))
        updateData[`data.${prof}`] = {
          value: [],
          custom: "",
        };
    }
  }
};

const _migrateItemNotes = function (ent, updateData) {
  const list = ["data.attackNotes", "data.effectNotes"];
  for (let k of list) {
    const value = getProperty(ent, k);
    const hasValue = hasProperty(ent, k);
    if (hasValue && !(value instanceof Array)) {
      updateData[k] = [];
      if (typeof value === "string" && value.length > 0) {
        updateData[k] = value.split(/[\n\r]/);
      }
    }
  }
};

const _migrateActorCR = function (ent, updateData) {
  // Migrate base CR
  const cr = getProperty(ent, "data.details.cr");
  if (typeof cr === "number") {
    updateData["data.details.cr.base"] = cr;
    updateData["data.details.cr.total"] = cr;
  } else if (cr == null) {
    updateData["data.details.cr.base"] = 1;
    updateData["data.details.cr.total"] = 1;
  }
};

const _migrateAttackAbility = function (ent, updateData) {
  const cmbAbl = getProperty(ent, "data.attributes.cmbAbility");
  if (cmbAbl == null) updateData["data.attributes.cmbAbility"] = "str";

  const meleeAbl = getProperty(ent, "data.attributes.attack.meleeAbility");
  if (meleeAbl == null) updateData["data.attributes.attack.meleeAbility"] = "str";

  const rangedAbl = getProperty(ent, "data.attributes.attack.rangedAbility");
  if (rangedAbl == null) updateData["data.attributes.attack.rangedAbility"] = "dex";
};

const _migrateActorTokenVision = function (ent, updateData) {
  const vision = getProperty(ent, "data.attributes.vision");
  if (!vision) return;

  updateData["data.attributes.-=vision"] = null;
  updateData["token.flags.pf1.lowLightVision"] = vision.lowLight;
  if (!getProperty(ent, "token.brightSight")) updateData["token.brightSight"] = vision.darkvision ?? 0;
};

const _migrateActorSpellbookUsage = function (ent, updateData) {
  const spellbookUsage = getProperty(ent, "data.attributes.spells.usedSpellbooks");

  if (spellbookUsage == null) {
    let usedSpellbooks = [];
    if (!ent.items) return;
    const spells = ent.items.filter((o) => o.type === "spell");
    for (let o of spells) {
      const sb = o.data.spellbook;
      if (sb && !usedSpellbooks.includes(sb)) {
        usedSpellbooks.push(sb);
      }
    }
    updateData["data.attributes.spells.usedSpellbooks"] = usedSpellbooks;
  }
};

const _migrateActorNullValues = function (ent, updateData) {
  // Prepare test data
  const entries = { "data.attributes.energyDrain": getProperty(ent, "data.attributes.energyDrain") };
  for (let [k, a] of Object.entries(getProperty(ent.data, "data.abilities") || {})) {
    entries[`data.abilities.${k}.damage`] = a.damage;
    entries[`data.abilities.${k}.drain`] = a.drain;
    entries[`data.abilities.${k}.penalty`] = a.penalty;
  }

  // Set null values to 0
  for (let [k, v] of Object.entries(entries)) {
    if (v === null) {
      updateData[k] = 0;
    }
  }
};

const _migrateActorSpellbookDomainSlots = function (ent, updateData) {
  const spellbooks = getProperty(ent, "data.attributes.spells.spellbooks") || {};

  for (let [k, b] of Object.entries(spellbooks)) {
    if (b.domainSlotValue !== undefined) continue;
    const key = `data.attributes.spells.spellbooks.${k}.domainSlotValue`;
    updateData[key] = 1;
  }
};

const _migrateActorStatures = function (ent, updateData) {
  const stature = getProperty(ent, "data.traits.stature");

  if (stature === undefined) {
    updateData["data.traits.stature"] = "tall";
  }
};

const _migrateActorDefenseAbility = function (ent, updateData) {
  const normalACAbl = getProperty(ent, "data.attributes.ac.normal.ability");
  if (normalACAbl === undefined) updateData["data.attributes.ac.normal.ability"] = "dex";
  const touchACAbl = getProperty(ent, "data.attributes.ac.touch.ability");
  if (touchACAbl === undefined) updateData["data.attributes.ac.touch.ability"] = "dex";
  const cmdAbl = getProperty(ent, "data.attributes.cmd.dexAbility");
  if (cmdAbl === undefined) updateData["data.attributes.cmd.dexAbility"] = "dex";
};

const _migrateActorInitAbility = function (ent, updateData) {
  const abl = getProperty(ent, "data.attributes.init.ability");

  if (abl === undefined) {
    updateData["data.attributes.init.ability"] = "dex";
  }
};

const _migrateActorChangeRevamp = function (ent, updateData) {
  const keys = {
    "data.attributes.ac.normal.total": 10,
    "data.attributes.ac.touch.total": 10,
    "data.attributes.ac.flatFooted.total": 10,
    "data.attributes.cmd.total": 10,
    "data.attributes.cmd.flatFootedTotal": 10,
    "data.attributes.sr.total": 0,
    "data.attributes.init.total": 0,
    "data.attributes.cmb.total": 0,
    "data.attributes.hp.max": 0,
  };

  const skillKeys = Object.keys(getProperty(ent, "data.skills") ?? {}).reduce((cur, s) => {
    cur.push(`data.skills.${s}.changeBonus`);
    // Check for subskill
    Object.keys(getProperty(ent, `data.skills.${s}.subSkills`) ?? {}).forEach((s2) => {
      cur.push(`data.skills.${s}.subSkills.${s2}.changeBonus`);
    });

    return cur;
  }, []);
  for (let k of skillKeys) {
    keys[k] = 0;
  }

  for (const [k, v] of Object.entries(keys)) {
    updateData[k] = v;
  }
};

const _migrateActorConditions = function (ent, updateData) {
  // Migrate fear to shaken
  {
    const cond = getProperty(ent, "data.conditions.fear");
    if (cond === true) {
      updateData["data.conditions.shaken"] = true;
      updateData["data.conditions.-=fear"] = null;
    }
  }
};
