import { ItemPF } from "./documents/item/item-pf.mjs";
import { createTag } from "./utils/lib.mjs";
import { ItemChange } from "./components/change.mjs";

/**
 * An indicator for whether the system is currently migrating the world.
 *
 * @type {boolean}
 */
// As the `pf1` global does not use this ES module but a cloned copy, this value
// only exists for the documentation. Always use `pf1.migrations.isMigrating` instead!
export let isMigrating = false; // eslint-disable-line prefer-const -- pf1.migrations.isMigrating is changed at runtime

/**
 * Perform a system migration for the entire World,
 * applying migrations for Actors, Items, Scenes, Tokens and Compendium packs
 *
 * @param {object} [options={}] - Additional options
 * @param {boolean} [options.unlock=false] - If false, locked compendiums are ignored.
 * @param {boolean} [options.systemPacks=false] - Migrate system packs.
 * @returns {Promise<void>} - A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function ({ unlock = false, systemPacks = false } = {}) {
  if (!game.user.isGM) {
    return void ui.notifications.error(game.i18n.localize("PF1.ErrorUnauthorizedAction"));
  }

  if (pf1.migrations.isMigrating) {
    return void ui.notifications.error(game.i18n.localize("PF1.Migration.AlreadyInProgress"));
  } else {
    pf1.migrations.isMigrating = true;
    Hooks.callAll("pf1MigrationStarted");
  }

  const startMessage = game.i18n.format("PF1.Migration.Start", { version: game.system.version });
  ui.notifications.info(startMessage, {
    permanent: true,
  });
  console.log("System Migration starting.");
  // Overloaded. Can be jQuery notification or queue object
  const removeNotification = function (li) {
    if (li.fadeOut) {
      li.fadeOut(66, () => li.remove());
      ui.notifications.active = ui.notifications.active.filter((o) => o != li);
      ui.notifications.fetch();
    } else ui.notifications.queue = ui.notifications.queue.filter((o) => o != li);
  };

  await _migrateWorldSettings();

  // Migrate World Actors
  await migrateActors();

  // Migrate World Items
  await migrateItems();

  // Migrate Actor Override Tokens
  await migrateScenes();

  // Migrate Compendium Packs
  const packs = game.packs.filter((p) => {
    // Ingore locked unless we're allowed to unlock them
    if (p.locked && !unlock) return false;

    const source = p.metadata.packageType;
    // Ignore modules, adventures, etc.
    if (!["world", "system"].includes(source)) return false;
    // Ignore system packs unless configured to include them
    if (source === "system" && !systemPacks) return false;
    // Ignore unsupported pack types
    return ["Actor", "Item", "Scene"].includes(p.metadata.type);
  });

  await migrateCompendiums(packs, { unlock });

  // Set the migration as complete
  await game.settings.set("pf1", "systemMigrationVersion", game.system.version);
  const infoElem =
    ui.notifications.queue.find((o) => o.permanent && o.message == startMessage) ||
    ui.notifications.active.find((o) => o.hasClass("permanent") && o[0].innerText === startMessage);
  if (infoElem) removeNotification(infoElem);

  // Remove migration notification
  ui.notifications.info(game.i18n.format("PF1.Migration.End", { version: game.system.version }), { console: false });
  console.log("System Migration completed.");
  pf1.migrations.isMigrating = false;

  Hooks.callAll("pf1MigrationFinished");
};

/**
 * Migrate actors directory.
 *
 * @returns {Promise<void>}
 */
export async function migrateActors() {
  console.log("Actors directory migration starting...");
  for (const actor of game.actors) {
    try {
      const updateData = migrateActorData(actor.toObject());
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Actor document ${actor.name}`);
        await actor.update(updateData);
      }
    } catch (err) {
      console.error(`Error migrating actor document ${actor.name}`, err);
    }
  }
  console.log("Actors directory migration complete!");
}

/**
 * Migrate items directory.
 *
 * @returns {Promise<void>}
 */
export const migrateItems = async () => {
  console.log("Items directory migration starting...");
  for (const item of game.items) {
    try {
      const updateData = migrateItemData(item.toObject());
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Item document ${item.name}`);
        await item.update(updateData);
      }
    } catch (err) {
      console.error(`Error migrating item document ${item.name}`, err);
    }
  }
  console.log("Items directory migation complete!");
};

/**
 * Migrate all scenes.
 *
 * @see {@link migrateScene}
 *
 * @returns {Promise<void>}
 */
export const migrateScenes = async () => {
  console.log("Scene migration starting...");
  for (const scene of game.scenes) {
    console.log(`Migrating Scene document "${scene.name}"`);
    await migrateScene(scene);
  }
  console.log("Scene migration finished!");
};

/**
 * Migrate compendiums.
 *
 * @see {@link migrateCompendium}
 *
 * @param {Array<string|WorldCollection>|null} [packIds=null] - Array of pack IDs or packs to migrate. If null, all packs will be migrated.
 * @param {object} [options={}] - Additional options to pass along.
 * @param {boolean} [options.unlock=false] - If false, locked compendiums are ignored.
 * @returns {Promise<void>} - Promise that resolves once all migrations are complete.
 * @throws {Error} - If defined pack is not found.
 */
export const migrateCompendiums = async (packIds = null, { unlock = false } = {}) => {
  if (packIds === null) packIds = [...game.packs];
  for (const pack of packIds) {
    try {
      await migrateCompendium(pack, { unlock });
    } catch (error) {
      console.error(error);
    }
  }
};

/**
 * Migrate system compendia.
 *
 * Convenience wrapper for migrateCompendiums.
 *
 * @see {@link migrateCompendiums}
 *
 * @param {object} [options={}] - Additional options
 * @param {boolean} [options.unlock] - Unlock compendiums
 * @returns {Promise<void>}
 */
export const migrateSystem = async ({ unlock = true } = {}) => {
  const packs = game.packs.filter((p) => p.metadata.packageType === "system");
  return migrateCompendiums(packs, { unlock });
};

/**
 * Migrate module compendia.
 *
 * Convenience wrapper for migrateCompendiums.
 *
 * @see {@link migrateCompendiums}
 *
 * @param {object} [options={}] Additional options
 * @param {boolean} [options.unlock] Unlock compendiums
 * @returns {Promise<void>}
 */
export const migrateModules = ({ unlock = true } = {}) => {
  const packs = game.packs.filter((p) => p.metadata.packageType === "module");
  return migrateCompendiums(packs, { unlock });
};

/* -------------------------------------------- */

/**
 * Apply migration rules to all Documents within a single Compendium pack
 *
 * @param {CompendiumCollection|string} pack - Compendium (or its ID) to migrate
 * @param {object} [options={}] - Additional options
 * @param {boolean} [options.unlock=false] - If false, locked compendium will be ignored.
 * @returns {Promise<void>} - Promise that resolves once migration is complete.
 * @throws {Error} - If defined pack is not found.
 */
export const migrateCompendium = async function (pack, { unlock = false } = {}) {
  if (typeof pack === "string") {
    pack = game.packs.get(pack);
    if (!pack) throw new Error(`Compendium "${pack}" not found.`);
  }

  if (pack.locked && !unlock) return;

  const docType = pack.metadata.type;
  if (!["Actor", "Item", "Scene"].includes(docType)) return;

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  // Begin by requesting server-side data model migration and get the migrated content
  await pack.migrate();

  // Iterate over compendium entries - applying fine-tuned migration functions
  console.log(`Migrating ${docType} documents in Compendium ${pack.collection}`);

  try {
    switch (docType) {
      case "Item":
        await pack.updateAll((item) => migrateItemData(item.toObject()));
        break;
      case "Actor":
        await pack.updateAll((actor) => migrateActorData(actor.toObject()));
        break;
      case "Scene": {
        await pack.updateAll((scene) => migrateSceneData(scene.toObject()));
        break;
      }
    }
  } catch (err) {
    console.error(`Error migrating Compendium ${pack.collection}`, err);
  }

  if (wasLocked) await pack.configure({ locked: true });

  console.log(`Compendium "${pack.collection}" migration complete!`);
};

/**
 * Migrates world settings.
 */
const _migrateWorldSettings = async function () {
  const tooltipWorldConfig = game.settings.get("pf1", "tooltipWorldConfig");
  if (tooltipWorldConfig.hideActorName !== undefined) {
    // 1 (All) for true, -2 (None) for false
    tooltipWorldConfig.hideActorNameByDisposition == tooltipWorldConfig.hideActorName ? 1 : -2;
    game.settings.set("pf1", "tooltipWorldConfig", tooltipWorldConfig);
  }
};

/* -------------------------------------------- */
/*  Document Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate data in tokens that is no longer used.
 *
 * @param {object} token Token data
 */
export const migrateTokenData = function (token) {
  const flags = token.flags?.pf1 ?? {};

  // Remove obsolete flags
  if (flags.lowLightVision !== undefined) {
    token["flags.pf1.-=lowLightVision"] = null;
  }
  if (flags.lowLightVisionMultiplier !== undefined) {
    token["flags.pf1.-=lowLightVisionMultiplier"] = null;
  }
  if (flags.lowLightVisionMultiplierBright !== undefined) {
    token["flags.pf1.-=lowLightVisionMultiplierBright"] = null;
  }

  // Remove disabled but still in use flags
  if (flags.disableLowLight === false) {
    token["flags.pf1.-=disableLowLight"] = null;
  }
  if (flags.staticSize === false) {
    token["flags.pf1.-=staticSize"] = null;
  }
  if (flags.customVisionRules === false) {
    token["flags.pf1.-=customVisionRules"] = null;
  }

  // Remove data from v9 vision handling
  // Added with PF1 v9.4
  if (!flags.customVisionRules) {
    // Attempt to preserve vision range after migration
    if (token.sight.visionMode !== "basic") {
      if (token.sight.range !== 0) token["sight.range"] = 0;
      token["sight.visionMode"] = "basic";
    }
    if ("saturation" in token.sight) token["sight.-=saturation"] = null;
    if ("brightness" in token.sight) token["sight.-=brightness"] = null;
    if ("attenuation" in token.sight) token["sight.-=attenuation"] = null;
    if ("contrast" in token.sight) token["sight.-=contrast"] = null;
    if (token.detectionModes?.length) token["detectionModes"] = [];
  }
};

/**
 * Migrate token.
 *
 * @param {TokenDocument} token - Token to migrate
 * @returns {Promise<TokenDocument|null>} - Promise to updated document,. or null if no update was done.
 */
export async function migrateToken(token) {
  const tokenData = token.toObject();
  migrateTokenData(tokenData);
  return token.update(tokenData);
}

/**
 * Migrate singular actor document.
 *
 * @param {Actor} actor - Actor to migrate.
 * @returns {Promise<Actor|null>}
 */
export async function migrateActor(actor) {
  const updateData = migrateActorData(actor.toObject(), actor.token);
  if (!foundry.utils.isEmpty(updateData)) {
    return actor.update(updateData);
  }
  return null;
}

/**
 * Migrate a single Actor document to incorporate latest data model changes
 * Return an Object of updateData to be applied
 *
 * @param {ActorData} actor   The actor data to derive an update from
 * @param {TokenDocument} token
 * @returns {object}          The updateData to apply
 */
export function migrateActorData(actor, token) {
  // Ignore basic actor type
  if (actor.type === "basic") return {};
  // Ignore module introduced types
  if (!game.system.template.Actor.types.includes(actor.type)) return {};

  const updateData = {};
  const linked = token?.isLinked ?? true;
  _migrateCharacterLevel(actor, updateData, linked);
  _migrateActorEncumbrance(actor, updateData, linked);
  _migrateActorNoteArrays(actor, updateData);
  _migrateActorSpeed(actor, updateData, linked);
  _migrateSpellDivineFocus(actor, updateData);
  _migrateActorConcentration(actor, updateData);
  _migrateActorSpellbookCL(actor, updateData);
  _migrateActorSpellbookSlots(actor, updateData, linked);
  _migrateActorConcentration(actor, updateData);
  _migrateActorBaseStats(actor, updateData);
  _migrateUnusedActorCreatureType(actor, updateData);
  _migrateActorSpellbookDCFormula(actor, updateData, linked);
  _migrateActorHPAbility(actor, updateData);
  _migrateActorCR(actor, updateData, linked);
  _migrateAttackAbility(actor, updateData, linked);
  _migrateActorDefenseAbility(actor, updateData);
  _migrateActorSpellbookUsage(actor, updateData, linked);
  _migrateActorNullValues(actor, updateData);
  _migrateActorSpellbookDomainSlots(actor, updateData);
  _migrateActorStatures(actor, updateData, linked);
  _migrateActorInitAbility(actor, updateData, linked);
  _migrateActorChangeRevamp(actor, updateData, linked);
  _migrateActorCMBRevamp(actor, updateData, linked);
  _migrateActorConditions(actor, updateData, linked);
  _migrateActorSkillRanks(actor, updateData, linked);
  _migrateCarryBonus(actor, updateData, linked);
  _migrateBuggedValues(actor, updateData, linked);
  _migrateSpellbookUsage(actor, updateData, linked);
  _migrateActorHP(actor, updateData, linked);
  _migrateActorSenses(actor, updateData, linked, token);
  _migrateActorSkillJournals(actor, updateData, linked);
  _migrateActorSubskillData(actor, updateData);
  _migrateActorUnusedData(actor, updateData);
  _migrateActorDRandER(actor, updateData);

  // Migrate Owned Items
  if (!actor.items) return updateData;
  const items = actor.items.reduce((arr, i) => {
    // Migrate the Owned Item
    const itemData = i instanceof CONFIG.Item.documentClass ? i.toObject() : i;
    const itemUpdate = migrateItemData(itemData, actor);

    // Update the Owned Item
    if (!foundry.utils.isEmpty(itemUpdate)) {
      itemUpdate._id = itemData._id;
      arr.push(expandObject(itemUpdate));
    }

    return arr;
  }, []);
  if (items.length > 0) updateData.items = items;
  return updateData;
}

/* -------------------------------------------- */

/**
 *  Migrate singular item document.
 *
 * @param {Item} item - Item document to update.
 * @returns {Promise<Item|null>} - Promise to updated item document, or null if no update was performed.
 */
export async function migrateItem(item) {
  const updateData = migrateItemData(item.toObject(), item.actor);
  if (!foundry.utils.isEmpty(updateData)) {
    return item.update(updateData);
  }
  return null;
}

/**
 * Migrate a single Item document to incorporate latest data model changes
 *
 * @param {object} item    The item data to derive an update from
 * @param actor
 * @param _d
 * @returns {object}       The updateData to apply
 */
export const migrateItemData = function (item, actor = null, _d = 0) {
  const updateData = {};

  // Migrate data to system
  if (item.system == null && item.data != null) {
    item = deepClone(item);
    item.system = item.data;
    delete item.data;
  }

  // Ignore module introduced types
  if (!game.system.template.Item.types.includes(item.type)) return {};

  _migrateItemArrayTypes(item, updateData);
  _migrateItemSpellUses(item, updateData);
  _migrateFlagsArrayToObject(item, updateData);
  _migrateWeaponImprovised(item, updateData);
  _migrateSpellDescription(item, updateData);
  _migrateClassDynamics(item, updateData);
  _migrateClassType(item, updateData);
  _migrateWeaponCategories(item, updateData);
  _migrateArmorCategories(item, updateData);
  _migrateItemSize(item, updateData);
  _migrateAbilityTypes(item, updateData);
  _migrateClassLevels(item, updateData);
  _migrateSavingThrowTypes(item, updateData);
  _migrateCR(item, updateData);
  _migrateItemChanges(item, updateData);
  _migrateEquipmentSize(item, updateData);
  _migrateTags(item, updateData);
  _migrateSpellCosts(item, updateData);
  _migrateLootEquip(item, updateData);
  _migrateItemLinks(item, updateData);
  _migrateProficiencies(item, updateData);
  _migrateItemNotes(item, updateData);
  _migrateSpellData(item, updateData);
  _migrateItemActions(item, updateData, actor);
  _migrateItemChargeCost(item, updateData);
  _migrateItemWeight(item, updateData);
  _migrateItemHealth(item, updateData);
  _migrateContainerPrice(item, updateData);
  _migrateItemType(item, updateData);
  _migrateItemLearnedAt(item, updateData);
  _migrateItemTuples(item, updateData);
  _migrateEquipmentCategories(item, updateData);
  _migrateItemUnusedData(item, updateData);

  // Migrate action data
  const alreadyHasActions = item.system.actions instanceof Array && item.system.actions.length > 0;
  const itemActionData = alreadyHasActions ? item.system.actions : updateData["system.actions"];
  if (itemActionData instanceof Array) {
    updateData["system.actions"] = itemActionData.map((action) => migrateItemActionData(action, item));
  }

  // Migrate container items
  if (item.system?.inventoryItems instanceof Array) {
    updateData["system.inventoryItems"] = item.system.inventoryItems.map((subItem) => {
      subItem.system ??= {}; // HACK: For corrupt container items

      const data = mergeObject(subItem, migrateItemData(subItem, actor, _d + 1), {
        inplace: false,
        performDeletions: true,
      });

      // Migrate data to system
      if (data.data != null) {
        data.system = mergeObject(data.data, data.system);
        delete data.data;
      }

      return data;
    });
  }

  // Return the migrated update data
  return updateData;
};

/**
 * Older actors incorrectly has .range.value as number instead of string
 *
 * @param action
 * @param item
 */
const _migrateActionRange = (action, item) => {
  const range = action.range?.value;
  if (range === null || range === "") {
    delete action.range.value;
  } else if (range !== undefined && typeof range !== "string") {
    action.range.value = String(range);
  }
};

/**
 * Migrates a single action within an item.
 *
 * @param {object} action - The action's data, which also serves as the update data to pass on.
 * @param {object} item - The item data this action is in.
 * @returns {object} The resulting action data.
 */
export const migrateItemActionData = function (action, item) {
  action = foundry.utils.mergeObject(pf1.components.ItemAction.defaultData, action);

  _migrateActionRange(action, item);
  _migrateActionDamageParts(action, item);
  _migrateUnchainedActionEconomy(action, item);
  _migrateActionDamageType(action, item);
  _migrateActionConditionals(action, item);
  _migrateActionEnhOverride(action, item);
  _migrateActionPrimaryAttack(action, item);
  _migrateActionChargeUsage(action, item);

  // Return the migrated update data
  return action;
};

/* -------------------------------------------- */

/**
 * Migrate singular scene document.
 *
 * @param {Scene} scene - Scene document to update.
 * @returns {Promise<void>}
 */
export async function migrateScene(scene) {
  try {
    await migrateSceneTokens(scene);
    await migrateSceneActors(scene);
  } catch (err) {
    console.error(`Error migrating scene document "${scene.name}"`, err);
  }
}

/**
 * Migrate a single Scene data object to incorporate changes to the data model of it's actor data overrides
 *
 * @param {object} scene - Scene data to Update
 * @returns {object} Update data to apply
 */
export const migrateSceneData = async function (scene) {
  const tokens = [];
  for (const token of scene.tokens) {
    if (token.actorLink) continue;
    const actorId = token.actorId;
    const actor = game.actors.get(token.actorId);
    if (!actor) continue;

    const t = deepClone(token);

    const mergedData = foundry.utils.mergeObject(actor.toObject(), t.delta ?? t.actorData);

    const actorUpdate = migrateActorData(mergedData, token);
    ["items", "effects"].forEach((embeddedName) => {
      if (!actorUpdate[embeddedName]?.length) return;
      const updates = new Map(actorUpdate[embeddedName].map((u) => [u._id, u]));
      mergedData[embeddedName].forEach((original) => {
        const update = updates.get(original._id);
        if (update) foundry.utils.mergeObject(original, update);
      });
      delete actorUpdate[embeddedName];
    });

    if (game.release.generation >= 11) foundry.utils.mergeObject(t.delta, actorUpdate);
    else foundry.utils.mergeObject(t.actorData, actorUpdate);

    migrateTokenData(t);

    tokens.push(t);
  }
  return { tokens };
};

/**
 * Migrate tokens in a single scene.
 *
 * @param {Scene} scene - The Scene to Update
 */
export async function migrateSceneTokens(scene) {
  for (const token of scene.tokens) {
    await migrateToken(token);
  }
}

/**
 * Migrate unlinked actors on a single scene.
 *
 * @param {Scene} scene - Scene to migrate actors in.
 * @returns {Promise<void>}
 */
export async function migrateSceneActors(scene) {
  for (const token of scene.tokens) {
    if (token.isLinked) continue;
    const actor = token.actor;
    if (!actor) continue;

    const updateData = migrateActorData(actor.toObject(), token);
    if (!foundry.utils.isEmpty(updateData)) {
      const items = updateData.items;
      delete updateData.items;
      const effects = updateData.effects;
      delete updateData.effects;
      if (!foundry.utils.isEmpty(updateData)) await actor.update(updateData);
      if (items?.length) await actor.updateEmbeddedDocuments("Item", items);
      if (effects?.length) await actor.updateEmbeddedDocuments("ActiveEffect", effects);
    }
  }
}

/* -------------------------------------------- */

const _migrateCharacterLevel = function (ent, updateData, linked) {
  const arr = ["details.level.value", "details.level.min", "details.level.max", "details.mythicTier"];
  if (!linked) return; // skip unlinked tokens
  for (const k of arr) {
    const value = getProperty(ent.system, k);
    if (value == null) {
      updateData["system." + k] = 0;
    }
  }
};

const _migrateActorEncumbrance = function (ent, updateData, linked) {
  const arr = {
    "system.attributes.encumbrance.level": "attributes.encumbrance.-=level",
    "system.attributes.encumbrance.levels.light": "attributes.encumbrance.levels.-=light",
    "system.attributes.encumbrance.levels.medium": "attributes.encumbrance.levels.-=medium",
    "system.attributes.encumbrance.levels.heavy": "attributes.encumbrance.levels.-=heavy",
    "system.attributes.encumbrance.levels.carry": "attributes.encumbrance.levels.-=carry",
    "system.attributes.encumbrance.levels.drag": "attributes.encumbrance.levels.-=drag",
    "system.attributes.encumbrance.carriedWeight": "attributes.encumbrance.-=carriedWeight",
  };
  for (const [key, updateKey] of Object.entries(arr)) {
    const value = getProperty(ent, key);
    if (value !== undefined) {
      updateData["system." + updateKey] = null;
    }
  }
};

/**
 * Convert array based flags into object.
 *
 * @param ent
 * @param updateData
 * @param linked
 */
const _migrateFlagsArrayToObject = function (ent, updateData) {
  const flags = ent.system.flags;
  if (!flags) return;
  const bflags = flags.boolean,
    dflags = flags.dictionary;

  if (Array.isArray(bflags)) {
    // Compatibility with old data: Convert old array into actual dictionary.
    updateData["system.flags.boolean"] = bflags.reduce((flags, flag) => {
      flags[flag] = true;
      return flags;
    }, {});
  }

  if (Array.isArray(dflags)) {
    updateData["system.flags.dictionary"] = dflags.reduce((flags, [key, value]) => {
      flags[key] = value;
      return flags;
    }, {});
  }
};

const _migrateActorNoteArrays = function (ent, updateData) {
  const list = ["system.attributes.acNotes", "system.attributes.cmdNotes", "system.attributes.srNotes"];
  for (const k of list) {
    const value = getProperty(ent, k);
    const hasValue = hasProperty(ent, k);
    if (hasValue && value instanceof Array) {
      updateData[k] = value.join("\n");
    }
  }
};

const _migrateActorSpeed = function (ent, updateData, linked) {
  const arr = [
    "attributes.speed.land",
    "attributes.speed.climb",
    "attributes.speed.swim",
    "attributes.speed.fly",
    "attributes.speed.burrow",
  ];
  for (const k of arr) {
    let value = getProperty(ent.system, k);
    if (!linked && value === undefined) continue; // skip with unlinked tokens
    if (typeof value === "string") value = parseInt(value);
    if (typeof value === "number") {
      updateData[`system.${k}.base`] = value;
    } else if (value === null) {
      updateData[`system.${k}.base`] = 0;
    } else if (value?.total !== undefined) {
      // Delete derived data
      updateData[`system.${k}.-=total`] = null;
    }

    // Add maneuverability
    if (k === "attributes.speed.fly" && getProperty(ent.system, `${k}.maneuverability`) === undefined) {
      updateData[`system.${k}.maneuverability`] = "average";
    }
  }
};

const _migrateActorSpellbookSlots = function (ent, updateData, linked) {
  for (const spellbookSlot of Object.keys(getProperty(ent, "system.attributes.spells.spellbooks") || {})) {
    if (getProperty(ent, `system.attributes.spells.spellbooks.${spellbookSlot}.autoSpellLevels`) == null) {
      updateData[`system.attributes.spells.spellbooks.${spellbookSlot}.autoSpellLevels`] = true;
    }

    for (let a = 0; a < 10; a++) {
      const baseKey = `system.attributes.spells.spellbooks.${spellbookSlot}.spells.spell${a}.base`;
      const maxKey = `system.attributes.spells.spellbooks.${spellbookSlot}.spells.spell${a}.max`;
      const base = getProperty(ent, baseKey);
      const max = getProperty(ent, maxKey);

      if (base === undefined) {
        if (!linked) continue; // skip with unlinked tokens
        if (typeof max === "number" && max > 0) {
          updateData[baseKey] = max.toString();
        }
      } else {
        const newBase = parseInt(base);
        if (newBase > 0) {
          if (newBase !== base) updateData[baseKey] = newBase;
        } else {
          // Remove pointless default value not present in new actors either
          updateData[`system.attributes.spells.spellbooks.${spellbookSlot}.spells.spell${a}.-=base`] = null;
        }
      }
    }
  }
};

const _migrateActorBaseStats = function (ent, updateData) {
  const keys = [
    "system.attributes.hp.base",
    "system.attributes.hd.base",
    "system.attributes.savingThrows.fort.value",
    "system.attributes.savingThrows.ref.value",
    "system.attributes.savingThrows.will.value",
  ];
  for (const k of keys) {
    if (
      k === "system.attributes.hp.base" &&
      !(getProperty(ent, "items") || []).filter((o) => o.type === "class").length
    )
      continue;
    if (getProperty(ent, k) !== undefined) {
      const kList = k.split(".");
      kList[kList.length - 1] = `-=${kList[kList.length - 1]}`;
      updateData[kList.join(".")] = null;
    }
  }
};

const _migrateUnusedActorCreatureType = function (ent, updateData) {
  const type = getProperty(ent, "system.attributes.creatureType");
  if (type != undefined) updateData["system.attributes.-=creatureType"] = null;
};

const _migrateActorSpellbookDCFormula = function (ent, updateData, linked) {
  const spellbooks = Object.keys(getProperty(ent, "system.attributes.spells.spellbooks") || {});

  for (const k of spellbooks) {
    const key = `system.attributes.spells.spellbooks.${k}.baseDCFormula`;
    const curFormula = getProperty(ent, key);
    if (!linked && curFormula === undefined) continue; // skip with unlinked tokens
    if (curFormula == null) updateData[key] = "10 + @sl + @ablMod";
  }
};

const _migrateActorSpellbookName = function (ent, updateData) {
  const spellbooks = Object.entries(getProperty(ent, "system.attributes.spells.spellbooks") || {});
  for (const [bookId, book] of spellbooks) {
    if (book.altName !== undefined) {
      const key = `system.attributes.spells.spellbooks.${bookId}`;
      updateData[`${key}.-=altName`] = null;
      if (book.altName.length) updateData[`${key}.name`] = book.altName;
    }
  }
};

const _migrateActorSpellbookCL = function (ent, updateData) {
  const spellbooks = Object.keys(getProperty(ent, "system.attributes.spells.spellbooks") || {});

  for (const k of spellbooks) {
    const key = `system.attributes.spells.spellbooks.${k}.cl`;
    const curBase = parseInt(getProperty(ent, key + ".base"));
    const curFormula = getProperty(ent, key + ".formula");
    if (curBase > 0) {
      if (curFormula.length > 0) updateData[`${key}.formula`] = curFormula + " + " + curBase;
      else updateData[`${key}.formula`] = curFormula + curBase;
      updateData[`${key}.base`] = 0;
    }
  }
};

const _migrateActorConcentration = function (ent, updateData) {
  const spellbooks = Object.keys(getProperty(ent, "system.attributes.spells.spellbooks") || {});
  for (const k of spellbooks) {
    // Delete unused .concentration from old actors
    const key = `system.attributes.spells.spellbooks.${k}`;
    const oldValue = getProperty(ent, `${key}.concentration`);
    const isString = typeof oldValue === "string";
    if (Number.isFinite(oldValue) || isString) updateData[`${key}.-=concentration`] = null;
    if (isString) {
      // Assume erroneous bonus formula location and combine it with existing bonus formula.
      const formulaKey = `${key}.concentrationFormula`;
      const formula = [oldValue];
      formula.push(getProperty(ent, formulaKey) || "");
      updateData[formulaKey] = formula.filter((f) => f !== 0 && f?.toString().trim().length).join(" + ");
    }
  }
};

const _migrateActorHPAbility = function (ent, updateData) {
  // Set HP ability
  if (getProperty(ent, "system.attributes.hpAbility") === undefined) {
    updateData["system.attributes.hpAbility"] = "con";
  }

  // Set Fortitude save ability
  if (getProperty(ent, "system.attributes.savingThrows.fort.ability") === undefined) {
    updateData["system.attributes.savingThrows.fort.ability"] = "con";
  }

  // Set Reflex save ability
  if (getProperty(ent, "system.attributes.savingThrows.ref.ability") === undefined) {
    updateData["system.attributes.savingThrows.ref.ability"] = "dex";
  }

  // Set Will save ability
  if (getProperty(ent, "system.attributes.savingThrows.will.ability") === undefined) {
    updateData["system.attributes.savingThrows.will.ability"] = "wis";
  }
};

const _migrateItemArrayTypes = function (ent, updateData) {
  const conditionals = getProperty(ent, "system.conditionals");
  if (conditionals != null && !(conditionals instanceof Array)) {
    updateData["system.conditionals"] = [];
  }

  const contextNotes = getProperty(ent, "system.contextNotes");
  if (contextNotes != null && !(contextNotes instanceof Array)) {
    if (contextNotes instanceof Object) updateData["system.contextNotes"] = Object.values(contextNotes);
    else updateData["system.contextNotes"] = [];
  }
};

const _migrateItemSpellUses = function (ent, updateData) {
  if (getProperty(ent.system, "preparation") === undefined) return;

  const value = getProperty(ent.system, "preparation.maxAmount");
  if (typeof value !== "number") updateData["system.preparation.maxAmount"] = 0;
};

const _migrateWeaponImprovised = function (ent, updateData) {
  if (ent.type !== "weapon") return;

  const value = getProperty(ent.system, "weaponType");
  if (value === "improv") {
    updateData["system.weaponType"] = "misc";
    updateData["system.properties.imp"] = true;
  }
};

const _migrateSpellDescription = function (ent, updateData) {
  if (ent.type !== "spell") return;

  const curValue = getProperty(ent, "system.shortDescription");
  if (curValue != null) return;

  const obj = getProperty(ent, "system.description.value");
  if (typeof obj !== "string") return;
  const html = $(`<div>${obj}</div>`);
  const elem = html.find("h2").next();
  if (elem.length === 1) updateData["system.shortDescription"] = elem.prop("outerHTML");
  else updateData["system.shortDescription"] = html.prop("innerHTML");
};

const _migrateSpellDivineFocus = function (ent, updateData) {
  if (ent.type !== "spell") return;

  const value = getProperty(ent, "system.components.divineFocus");
  if (typeof value === "boolean") updateData["system.components.divineFocus"] = value === true ? 1 : 0;
};

const _migrateClassDynamics = function (ent, updateData) {
  if (ent.type !== "class") return;

  const bab = getProperty(ent, "system.bab");
  if (typeof bab === "number") updateData["system.bab"] = "low";

  const stKeys = ["system.savingThrows.fort.value", "system.savingThrows.ref.value", "system.savingThrows.will.value"];
  for (const key of stKeys) {
    const value = getProperty(ent, key);
    if (typeof value === "number") updateData[key] = "low";
  }
};

const _migrateClassType = function (ent, updateData) {
  if (ent.type !== "class") return;

  if (getProperty(ent, "system.classType") == null) updateData["system.classType"] = "base";
};

const _migrateWeaponCategories = function (ent, updateData) {
  if (ent.type !== "weapon") return;

  // Change category
  const type = getProperty(ent, "system.weaponType");
  if (type === "misc") {
    updateData["system.weaponType"] = "misc";
    updateData["system.weaponSubtype"] = "other";
  } else if (type === "splash") {
    updateData["system.weaponType"] = "misc";
    updateData["system.weaponSubtype"] = "splash";
  }

  const changeProp = ["simple", "martial", "exotic"].includes(type);
  if (changeProp && getProperty(ent, "system.weaponSubtype") == null) {
    updateData["system.weaponSubtype"] = "1h";
  }

  // Change light property
  const lgt = getProperty(ent, "system.properties.lgt");
  if (lgt != null) {
    updateData["system.properties.-=lgt"] = null;
    if (lgt === true && changeProp) {
      updateData["system.weaponSubtype"] = "light";
    }
  }

  // Change two-handed property
  const two = getProperty(ent, "system.properties.two");
  if (two != null) {
    updateData["system.properties.-=two"] = null;
    if (two === true && changeProp) {
      updateData["system.weaponSubtype"] = "2h";
    }
  }

  // Change melee property
  const melee = getProperty(ent, "system.weaponData.isMelee");
  if (melee != null) {
    updateData["system.weaponData.-=isMelee"] = null;
    if (melee === false && changeProp) {
      updateData["system.weaponSubtype"] = "ranged";
    }
  }
};

const _migrateArmorCategories = function (ent, updateData) {
  if (ent.type !== "equipment") return;

  const oldType = getProperty(ent, "system.armor.type");
  if (oldType == null) return;

  if (oldType === "clothing") {
    updateData["system.equipmentType"] = "misc";
    updateData["system.equipmentSubtype"] = "clothing";
  } else if (oldType === "shield") {
    updateData["system.equipmentType"] = "shield";
    updateData["system.equipmentSubtype"] = "lightShield";
  } else if (oldType === "misc") {
    updateData["system.equipmentType"] = "misc";
    updateData["system.equipmentSubtype"] = "wondrous";
  } else if (["light", "medium", "heavy"].includes(oldType)) {
    updateData["system.equipmentType"] = "armor";
    updateData["system.equipmentSubtype"] = `${oldType}Armor`;
  }

  updateData["system.armor.-=type"] = null;
};

const _migrateEquipmentCategories = (item, updateData) => {
  if (item.type !== "equipment") return;

  const subtype = updateData["system.subType"] ?? item.system.subType;
  if (subtype !== "misc") return;

  switch (item.system.equipmentSubtype) {
    case "wondrous":
      updateData["system.subType"] = "wondrous";
      updateData["system.-=equipmentSubtype"] = null;
      break;
    case "clothing":
      updateData["system.subType"] = "clothing";
      updateData["system.-=equipmentSubtype"] = null;
      break;
    case "other":
      updateData["system.subType"] = "other";
      updateData["system.-=equipmentSubtype"] = null;
      break;
  }
};

const _migrateItemSize = function (ent, updateData, linked) {
  // Convert custom sizing in weapons
  if (ent.type === "weapon") {
    const wdSize = getProperty(ent, "system.weaponData.size");
    if (wdSize) {
      // Move old
      updateData["system.size"] = wdSize;
      updateData["system.weaponData.-=size"] = null;
      return;
    }
  }

  const oldSize = getProperty(ent, "system.size");
  if (["spell", "class", "buff", "feat"].includes(ent.type)) {
    // Remove size from abstract items
    if (oldSize !== undefined) {
      updateData["system.-=size"] = null;
    }
  } else {
    // Add default size to everything else if not present
    if (oldSize === undefined) {
      updateData["system.size"] = "med";
    }
  }
};

const _migrateAbilityTypes = function (ent, updateData) {
  if (ent.type !== "feat") return;

  if (getProperty(ent, "system.abilityType") == null) {
    updateData["system.abilityType"] = "none";
  }
  // Fix buggy value
  if (getProperty(ent, "system.abilityType") === "n/a") {
    updateData["system.abilityType"] = "none";
  }
};

const _migrateClassLevels = function (ent, updateData) {
  const level = getProperty(ent, "system.levels");
  if (typeof level === "number" && getProperty(ent, "system.level") == null) {
    updateData["system.level"] = level;
    updateData["system.-=levels"] = null;
  }
};

const _migrateSavingThrowTypes = function (ent, updateData) {
  if (getProperty(ent, "system.save.type") == null && typeof getProperty(ent, "system.save.description") === "string") {
    const desc = getProperty(ent, "system.save.description");
    if (desc.match(/REF/i)) updateData["system.save.type"] = "ref";
    else if (desc.match(/FORT/i)) updateData["system.save.type"] = "fort";
    else if (desc.match(/WILL/i)) updateData["system.save.type"] = "will";
  }
};

const _migrateCR = function (ent, updateData) {
  // Migrate CR offset
  const crOffset = getProperty(ent, "system.crOffset");
  if (typeof crOffset === "number") {
    updateData["system.crOffset"] = crOffset.toString();
  }
};

const _migrateItemChanges = function (ent, updateData) {
  // Migrate changes
  const changes = getProperty(ent, "system.changes");
  if (changes != null && changes instanceof Array) {
    const newChanges = [];
    for (const c of changes) {
      if (c instanceof Array) {
        const newChange = new ItemChange(
          {
            formula: c[0],
            target: c[1],
            subTarget: c[2],
            modifier: c[3],
            value: c[4],
          },
          null
        );
        newChanges.push(newChange.data);
      } else {
        const newChange = new ItemChange(c, null);
        newChanges.push(newChange.data);
      }
    }

    // Alter the changes list, but only if at least one of them is nonzero length
    if (newChanges.length !== 0 && changes.length !== 0) {
      updateData["system.changes"] = newChanges;
    }
  }

  // Migrate context notes
  const notes = getProperty(ent, "system.contextNotes");
  if (notes != null && notes instanceof Array) {
    const newNotes = [];
    for (const n of notes) {
      if (n instanceof Array) {
        newNotes.push(
          foundry.utils.mergeObject(ItemPF.defaultContextNote, { text: n[0], subTarget: n[2] }, { inplace: false })
        );
      } else {
        newNotes.push(n);
      }

      // Migrate old note targets
      if (n.target === "spell" && n.subTarget === "effect") {
        n.subTarget = "spellEffect";
      }
    }

    // Alter the context note list, but only if at least one of them is nonzero length
    if (newNotes.length !== 0 && notes.length !== 0) {
      updateData["system.contextNotes"] = newNotes;
    }
  }
};

const _migrateEquipmentSize = function (ent, updateData) {
  if (ent.type !== "equipment") return;

  const size = getProperty(ent, "system.size");
  if (!size) {
    updateData["system.size"] = "med";
  }
};

// Migrate .weight number to .weight.value
// Migrate .baseWeight that was briefly introduced in 0.81
const _migrateItemWeight = function (ent, updateData) {
  const baseWeight = getProperty(ent, "system.baseWeight"),
    weight = getProperty(ent, "system.weight");

  // Skip items of inappropriate type
  if (!game.system.template.Item[ent.type].templates.includes("physicalItem")) {
    if (weight !== undefined) {
      // Ensure inappropriate items don't have spurious weight, which breaks data prep
      updateData["system.-=weight"] = null;
    }
    return;
  }

  if (Number.isFinite(weight)) {
    updateData["system.weight.value"] = weight;
  } else if (weight == null || typeof weight !== "object") {
    // Convert any other values to just 0 weight, e.g. null
    updateData["system.weight.value"] = 0;
  }

  // If baseWeight exists and looks reasonable, use it for base weight instead
  if (baseWeight !== undefined) {
    if (Number.isFinite(baseWeight) && baseWeight > 0) {
      updateData["system.weight.value"] = baseWeight;
    }
    updateData["system.-=baseWeight"] = null;
  }
};

const _migrateItemHealth = function (item, updateData) {
  const isPhysical = CONFIG.Item.documentClasses[item.type]?.isPhysical;

  const hp = item.system.hp;
  if (isPhysical) {
    if (hp) {
      // Fix invalid data type
      if (typeof hp.max === "string") updateData["system.hp.max"] = parseInt(hp.max);
      if (typeof hp.value === "string") updateData["system.hp.value"] = parseInt(hp.value);
    } else {
      // Restore missing HP data
      updateData["system.hp.value"] = 10;
      updateData["system.hp.max"] = 10;
    }
  } else if (item.type !== "class" && hp !== undefined) {
    updateData["system.-=hp"] = null;
  }
};

const _migrateTags = function (ent, updateData) {
  if (!["class"].includes(ent.type)) return;

  const tag = getProperty(ent, "system.tag");
  if (!tag && ent.name) {
    updateData["system.tag"] = createTag(ent.name);
  }
};

const _migrateSpellCosts = function (ent, updateData) {
  if (ent.type !== "spell") return;

  const spellPointCost = getProperty(ent, "system.spellPoints.cost");
  if (spellPointCost == null) {
    updateData["system.spellPoints.cost"] = "1 + @sl";
  }

  const slotCost = getProperty(ent, "system.slotCost");
  if (slotCost == null) {
    updateData["system.slotCost"] = 1;
  }

  const autoDeduct = ent.system.preparation?.autoDeductCharges;
  if (autoDeduct !== undefined) {
    if (autoDeduct === false) {
      updateData["system.uses.autoDeductChargesCost"] = "0";
    }
    updateData["system.preparation.-=autoDeductCharges"] = null;
  }
};

const _migrateLootEquip = function (ent, updateData) {
  if (ent.type === "loot" && !hasProperty(ent, "system.equipped")) {
    updateData["system.equipped"] = false;
  }
};

const _migrateUnchainedActionEconomy = (action, item) => {
  action.activation ??= {};
  // Migrate .unchainedAction.activation to .activation.unchained
  if (action.unchainedAction?.activation) {
    action.activation.unchained = action.unchainedAction.activation;
    delete action.unchainedAction;
  }
};

const _migrateItemLinks = function (ent, updateData) {
  if (["attack", "consumable", "equipment"].includes(ent.type) && !hasProperty(ent, "system.links.charges")) {
    updateData["system.links.charges"] = [];
  }

  const linkData = ent.system.links ?? {};
  for (const [linkType, oldLinks] of Object.entries(linkData)) {
    let updated = false;
    const links = deepClone(oldLinks);
    for (const link of links) {
      const type = link.dataType;
      if (type !== undefined) {
        if (type === "data") {
          delete link.dataType;
        } else if (type === "world") {
          // Reconstruct world item UUID
          link.uuid = link.id.replace(/^world\./, "Item.");
          delete link.id;
          delete link.dataType;
        } else if (type === "compendium") {
          // Reconstruct compendium UUID
          link.uuid = `Compendium.${link.id}`;
          delete link.id;
          delete link.dataType;
        }
        delete link.img;
        updated = true;
      }

      if (link._index !== undefined) {
        delete link._index;
        updated = true;
      }

      if (link.hiddenLinks !== undefined) {
        delete link.hiddenLinks;
        updated = true;
      }
    }

    if (updated) {
      updateData[`system.links.${linkType}`] = links;
    }
  }
};

const _migrateProficiencies = function (ent, updateData) {
  // Add proficiency objects to items able to grant proficiencies
  if (["feat", "class", "race"].includes(ent.type)) {
    for (const prof of ["armorProf", "weaponProf"]) {
      if (!hasProperty(ent, `system.${prof}`))
        updateData[`system.${prof}`] = {
          value: [],
          custom: "",
        };
    }
  }
};

const _migrateItemNotes = function (ent, updateData) {
  const list = ["system.attackNotes", "system.effectNotes"];
  for (const k of list) {
    const value = getProperty(ent, k);
    const hasValue = hasProperty(ent, k);
    if (hasValue && !(value instanceof Array)) {
      updateData[k] = [];
      if (typeof value === "string" && value.length > 0) {
        updateData[k] = value.trim().split(/[\n\r]/);
      }
    }
  }
};

/**
 * @param item
 * @param updateData
 */
const _migrateSpellData = function (item, updateData) {
  if (item.type === "spell") {
    if (item.system.description?.value !== undefined) {
      updateData["system.description.-=value"] = null;
    }
  }
};

const _migrateItemActions = function (item, updateData, actor = null) {
  const hasOldAction =
    !!item.system.actionType || !!item.system.activation?.type || !!item.system.measureTemplate?.type;
  const alreadyHasActions = item.system.actions instanceof Array && item.system.actions.length > 0;
  if ((!hasOldAction && item.type !== "spell") || alreadyHasActions) return;

  // Transfer data to an action
  const actionData = pf1.components.ItemAction.defaultData;
  const removeKeys = ["_id", "name", "img"];
  for (const k of Object.keys(actionData)) {
    if (!removeKeys.includes(k)) {
      if (item.system[k] != null) actionData[k] = deepClone(item.system[k]);
    }
  }

  // Transfer name and image
  if (["weapon", "attack"].includes(item.type)) {
    actionData.name = game.i18n.localize("PF1.Attack");
  } else {
    actionData.name = game.i18n.localize("PF1.Use");
  }
  actionData.img = item.img;
  // Clear description
  actionData.description = "";
  // Add spell data
  if (item.type === "spell") {
    // Make sure it has an activation type
    actionData.activation.type ||= "standard";

    // Transfer spell duration
    actionData.duration.value = item.system.spellDuration;

    // Transfer spell point cost
    if (actor != null) {
      const spellbookKey = item.system.spellbook;
      const spellbook = actor.system.attributes?.spells?.spellbooks?.[spellbookKey];
      if (spellbook.spellPoints?.useSystem) {
        const oldSpellPointCostFormula = item.system.spellPoints?.cost;
        if (oldSpellPointCostFormula) actionData.uses.autoDeductChargesCost = oldSpellPointCostFormula;
      }
    }
  }

  // Fix power attack multiplier being non-number
  const paMult = actionData.powerAttack?.multiplier;
  if (typeof paMult === "string") {
    if (paMult === "") delete actionData.powerAttack.multiplier;
    else actionData.powerAttack.multiplier = parseInt(paMult);
  }

  // Clean out old attack and effect notes
  updateData["system.attackNotes"] = [];
  updateData["system.effectNotes"] = [];

  updateData["system.actions"] = [actionData];
};

/**
 * Convert tuple learnedAt values into key:value pairs directly in the object.
 *
 * @param item
 * @param updateData
 */
const _migrateItemLearnedAt = (item, updateData) => {
  const learnedAt = item.system.learnedAt ?? {};
  for (const [category, value] of Object.entries(learnedAt)) {
    if (Array.isArray(value)) {
      updateData[`system.learnedAt.${category}`] = value.reduce((learned, [classId, level]) => {
        for (let clsId of classId.split("/")) {
          clsId = clsId.trim().replace(".", "-"); // Sanitize
          if (clsId) learned[clsId] = level;
        }
        return learned;
      }, {});
    }
  }
};

const _migrateActionChargeUsage = function (action, item) {
  if (action.uses?.autoDeductCharges !== undefined) {
    if (action.uses.autoDeductCharges === false) {
      action.uses.autoDeductChargesCost = "0";
    } else if (action.uses.autoDeductChargesCost === "1") action.uses.autoDeductChargesCost = "";
    delete action.uses.autoDeductCharges;
  }
};

const _migrateItemChargeCost = function (item, updateData) {
  const toggle = item.system.uses?.autoDeductCharges;
  if (toggle !== undefined) {
    // Mimic old setting by setting cost to 0
    if (toggle === false) {
      updateData["system.uses.autoDeductChargesCost"] = "0";
    }
    updateData["system.uses.-=autoDeductCharges"] = null;
  }
  // Special handling for cantrips if the above didn't match
  else if (item.system.level === 0 && item.system.uses?.autoDeductChargesCost === undefined) {
    const defaultAction = item.system.actions?.[0];
    // Check for presence of obsoleted autoDeductCharges in first action
    if (
      defaultAction?.uses.autoDeductCharges === true &&
      updateData["system.uses.autoDeductChargesCost"] === undefined
    ) {
      updateData["system.uses.autoDeductChargesCost"] = "0";
    }
  }
};

/**
 * Migrate damage part tuples into objects
 *
 * Introduced with PF1 v9
 *
 * @param {*} action
 * @param {*} item
 */
const _migrateActionDamageParts = function (action, item) {
  const categories = action.damage;
  for (const part of ["parts", "critParts", "nonCritParts"]) {
    const category = categories[part];
    if (!category) continue;

    category.forEach((damage, index) => {
      if (Array.isArray(damage)) {
        const [formula, type] = damage;
        category[index] = { formula, type };
      }
    });
  }
};

const _migrateActionDamageType = function (action, item) {
  // Determine data paths using damage types
  const damageGroupPaths = ["damage.parts", "damage.critParts", "damage.nonCritParts"];
  for (const damageGroupPath of damageGroupPaths) {
    const damageGroup = getProperty(action, damageGroupPath);
    for (const damagePart of damageGroup) {
      // Convert damage types
      const damageType = damagePart.type;
      if (typeof damageType === "string") {
        const damageTypeData = pf1.components.ItemAction.defaultDamageType;
        damageTypeData.values = _Action_ConvertDamageType(damageType);
        if (damageTypeData.values.length === 0) damageTypeData.custom = damageType;
        damagePart.type = damageTypeData;
      }
      // Convert array to object
      else if (damageType instanceof Array) {
        const damageTypeData = pf1.components.ItemAction.defaultDamageType;
        damageTypeData.values = damageType;
        damagePart.type = damageTypeData;
      }
    }
  }
};

const _migrateActionConditionals = function (action, item) {
  for (const conditional of action.conditionals ?? []) {
    // Create conditional ID
    if (!conditional._id) conditional._id = randomID(16);

    if (!Array.isArray(conditional.modifiers)) {
      conditional.modifiers = Object.values(conditional.modifiers);
    }

    for (const modifier of conditional.modifiers) {
      // Create modifier ID
      if (!modifier._id) modifier._id = randomID(16);

      // Ensure subTarget exists
      modifier.subTarget ??= "";

      let reResult;
      // Convert modifier subtarget
      if ((reResult = modifier.subTarget.match(/^attack\.([0-9]+)/))) {
        modifier.subTarget = `attack_${reResult[1]}`;
      }

      // Remove excess sheet data that was previously incorretly added
      delete modifier.targets;
      delete modifier.subTargets;
      delete modifier.conditionalModifierTypes;
      delete modifier.conditionalCritical;

      // Convert modifier damage type
      if (modifier.target === "damage" && !modifier.damageType) {
        const damageTypeData = pf1.components.ItemAction.defaultDamageType;
        damageTypeData.values = _Action_ConvertDamageType(modifier.type);
        if (damageTypeData.values.length === 0) damageTypeData.custom = modifier.type;
        modifier.damageType = damageTypeData;
        modifier.type = "";
      }
    }
  }
};

const _migrateActionEnhOverride = function (action, item) {
  if (typeof action.enh !== "object") {
    action.enh = { value: action.enh ?? null };
  }

  // Set to null if disabled.
  if (action.enh.override == false) {
    action.enh.value = null;
  }
  // Reset odd values to null, too.
  else if (action.enh.value !== null && typeof action.enh.value !== "number") {
    action.enh.value = null;
  }
  // Delete now unused .override toggle
  delete action.enh.override;
};

const _migrateActionPrimaryAttack = function (action, item) {
  if (action.naturalAttack?.primaryAttack === undefined) {
    setProperty(action, "naturalAttack.primaryAttack", item.system.primaryAttack);
  }
};

const _migrateActorCR = function (ent, updateData, linked) {
  // Migrate base CR
  const cr = getProperty(ent, "system.details.cr");
  if (!linked && cr === undefined) return; // skip with unlinked tokens
  if (typeof cr === "number") {
    updateData["system.details.cr.base"] = cr;
  } else if (cr == null) {
    updateData["system.details.cr.base"] = 1;
  }

  // Remove derived data if present
  if (getProperty(ent, "system.details.cr.total") !== undefined) {
    updateData["system.details.cr.-=total"] = null;
  }
};

const _migrateAttackAbility = function (ent, updateData, linked) {
  const cmbAbl = getProperty(ent, "system.attributes.cmbAbility");
  if (cmbAbl === undefined && linked) updateData["system.attributes.cmbAbility"] = "str";

  const meleeAbl = getProperty(ent, "system.attributes.attack.meleeAbility");
  if (meleeAbl === undefined && linked) updateData["system.attributes.attack.meleeAbility"] = "str";

  const rangedAbl = getProperty(ent, "system.attributes.attack.rangedAbility");
  if (rangedAbl === undefined && linked) updateData["system.attributes.attack.rangedAbility"] = "dex";
};

const _migrateActorSpellbookUsage = function (ent, updateData, linked) {
  const spellbookUsage = getProperty(ent, "system.attributes.spells.usedSpellbooks");
  if (spellbookUsage !== undefined) {
    updateData["system.attributes.spells.-=usedSpellbooks"] = null;
  }
};

const _migrateActorNullValues = function (ent, updateData) {
  // Prepare test data
  const entries = { "system.attributes.energyDrain": getProperty(ent, "system.attributes.energyDrain") };
  for (const [k, a] of Object.entries(getProperty(ent, "system.abilities") || {})) {
    entries[`system.abilities.${k}.damage`] = a.damage;
    entries[`system.abilities.${k}.drain`] = a.drain;
    entries[`system.abilities.${k}.penalty`] = a.penalty;
  }

  // Set null values to 0
  for (const [k, v] of Object.entries(entries)) {
    if (v === null) {
      updateData[k] = 0;
    }
  }
};

const _migrateActorSpellbookDomainSlots = function (ent, updateData) {
  const spellbooks = getProperty(ent, "system.attributes.spells.spellbooks") || {};

  for (const [k, b] of Object.entries(spellbooks)) {
    if (b.domainSlotValue !== undefined) continue;
    const key = `system.attributes.spells.spellbooks.${k}.domainSlotValue`;
    updateData[key] = 1;
  }
};

const _migrateActorStatures = function (ent, updateData) {
  const stature = getProperty(ent, "system.traits.stature");

  if (stature === undefined) {
    updateData["system.traits.stature"] = "tall";
  }
};

const _migrateActorDefenseAbility = function (ent, updateData) {
  const normalACAbl = getProperty(ent, "system.attributes.ac.normal.ability");
  if (normalACAbl === undefined) updateData["system.attributes.ac.normal.ability"] = "dex";
  const touchACAbl = getProperty(ent, "system.attributes.ac.touch.ability");
  if (touchACAbl === undefined) updateData["system.attributes.ac.touch.ability"] = "dex";

  // CMD
  const cmdDexAbl = getProperty(ent, "system.attributes.cmd.dexAbility");
  if (cmdDexAbl === undefined) updateData["system.attributes.cmd.dexAbility"] = "dex";
  const cmdStrAbl = getProperty(ent, "system.attributes.cmd.strAbility");
  if (cmdStrAbl === undefined) updateData["system.attributes.cmd.strAbility"] = "str";
};

const _migrateActorInitAbility = function (ent, updateData) {
  const abl = getProperty(ent, "system.attributes.init.ability");

  if (abl === undefined) {
    updateData["system.attributes.init.ability"] = "dex";
  }
};

const _migrateActorCMBRevamp = function (ent, updateData, linked) {
  if (getProperty(ent, "system.attributes.cmb.total") !== undefined) {
    updateData["system.attributes.cmb.-=total"] = null;
  }
};

const _migrateActorChangeRevamp = function (ent, updateData) {
  // Skills
  Object.keys(getProperty(ent, "system.skills") ?? {}).forEach((s) => {
    const path = `system.skills.${s}.`;
    if (getProperty(ent, path + "changeBonus") !== undefined) {
      updateData[path + "-=changeBonus"] = null;
    }

    // Check for subskill
    Object.keys(getProperty(ent, `system.skills.${s}.subSkills`) ?? {}).forEach((s2) => {
      const subPath = `system.skills.${s}.subSkills.${s2}.`;
      if (getProperty(ent, subPath + "changeBonus") !== undefined) {
        updateData[subPath + "-=changeBonus"] = null;
      }
    });
  });

  // Remove derived data
  const derivedKeys = {
    "system.attributes.hp.max": "attributes.hp.-=max",
    "system.attributes.ac.normal.total": "attributes.ac.normal.-=total",
    "system.attributes.ac.touch.total": "attributes.ac.touch.-=total",
    "system.attributes.ac.flatFooted.total": "attributes.ac.flatFooted.-=total",
    "system.attributes.cmd.total": "attributes.cmd.-=total",
    "system.attributes.cmd.flatFootedTotal": "attributes.cmd.-=flatFootedTotal",
    "system.attributes.sr.total": "attributes.sr.-=total",
    "system.attributes.init.total": "attributes.init.-=total",
  };

  Object.entries(derivedKeys).forEach(([key, updateKey]) => {
    if (getProperty(ent, key) !== undefined) {
      updateData["system." + updateKey] = null;
    }
  });
};

const _migrateActorConditions = function (ent, updateData) {
  // Migrate fear to shaken
  {
    const cond = getProperty(ent, "system.conditions.fear");
    if (cond !== undefined) {
      if (cond === true) updateData["system.attributes.conditions.shaken"] = true;
      updateData["system.conditions.-=fear"] = null;
    }
    const condAlt = getProperty(ent, "system.attributes.conditions.fear");
    if (condAlt !== undefined) {
      if (condAlt === true) updateData["system.attributes.conditions.shaken"] = true;
      updateData["system.attributes.conditions.-=fear"] = null;
    }
  }
};

/**
 * Migrate abnormal skill rank values to 0.
 * Primarily changing nulls to 0 to match new actors.
 *
 * @param ent
 * @param updateData
 * @param linked
 */
const _migrateActorSkillRanks = function (ent, updateData, linked) {
  const skills = getProperty(ent, "system.skills");
  if (!skills) return; // Unlinked with no skill overrides of any kind
  for (const [key, data] of Object.entries(skills)) {
    if (!linked && data.rank === undefined) continue; // Unlinked with no override
    if (!Number.isFinite(data.rank)) updateData[`system.skills.${key}.rank`] = 0;
    for (const [subKey, subData] of Object.entries(data.subSkills ?? {})) {
      if (!linked && subData.rank === undefined) continue; // Unlinked with no override
      if (!Number.isFinite(subData.rank)) updateData[`system.skills.${key}.subSkills.${subKey}.rank`] = 0;
    }
  }
};

const _migrateCarryBonus = function (ent, updateData, linked) {
  if (getProperty(ent, "system.details.carryCapacity.bonus.user") === undefined) {
    let bonus = getProperty(ent, "system.abilities.str.carryBonus");
    if (bonus !== undefined || linked) {
      bonus = bonus || 0;
      updateData["system.details.carryCapacity.bonus.user"] = bonus;
    }
    updateData["system.abilities.str.-=carryBonus"] = null;
  }
  if (getProperty(ent, "system.details.carryCapacity.multiplier.user") === undefined) {
    let mult = getProperty(ent, "system.abilities.str.carryMultiplier");
    if (mult !== undefined || linked) {
      mult = mult || 1;
      updateData["system.details.carryCapacity.multiplier.user"] = mult - 1;
    }
    updateData["system.abilities.str.-=carryMultiplier"] = null;
  }
};

const _migrateBuggedValues = function (ent, updateData, linked) {
  // Convert to integers
  const convertToInt = [
    "system.details.xp.value",
    "system.currency.pp",
    "system.currency.gp",
    "system.currency.sp",
    "system.currency.cp",
    "system.altCurrency.pp",
    "system.altCurrency.gp",
    "system.altCurrency.sp",
    "system.altCurrency.cp",
  ];
  for (const key of convertToInt) {
    const oldValue = getProperty(ent, key),
      value = parseInt(oldValue ?? 0);
    if (oldValue !== value) {
      updateData[key] = value;
    }
  }
};

const _migrateSpellbookUsage = function (ent, updateData, linked) {
  const usedSpellbooks = ent.items
    .filter((i) => i.type === "spell")
    .reduce((cur, i) => {
      if (!i.system.spellbook) return cur;
      if (cur.includes(i.system.spellbook)) return cur;
      cur.push(i.system.spellbook);
      return cur;
    }, []);

  for (const bookKey of usedSpellbooks) {
    const path = `system.attributes.spells.spellbooks.${bookKey}.inUse`;
    if (getProperty(ent, path) !== true) {
      updateData[path] = true;
    }
  }
};

const _migrateActorHP = function (ent, updateData, linked) {
  // Migrate HP, Wounds and Vigor values from absolutes to relatives, which is a change in 0.80.16
  for (const k of ["system.attributes.hp", "system.attributes.wounds", "system.attributes.vigor"]) {
    if (getProperty(ent, `${k}.offset`) == null) {
      const max = getProperty(ent, `${k}.max`) ?? 0;
      const value = getProperty(ent, `${k}.value`) ?? 0;
      updateData[`${k}.offset`] = value - max;
    }
  }
};

const _migrateActorSenses = function (ent, updateData, linked, token) {
  const oldSenses = ent.system.traits?.senses;
  if (typeof oldSenses === "string") {
    const tokenData = token ?? ent.prototypeToken;

    updateData["system.traits.senses"] = {
      dv: tokenData.brightSight,
      ts: 0,
      bs: 0,
      bse: 0,
      ll: {
        enabled: tokenData.flags?.pf1?.lowLightVision,
        multiplier: {
          dim: tokenData.flags?.pf1?.lowLightVisionMultiplier ?? 2,
          bright: tokenData.flags?.pf1?.lowLightVisionMultiplierBright ?? 2,
        },
      },
      sid: false,
      tr: false,
      si: false,
      sc: 0,
      custom: oldSenses,
    };
  }

  // Migrate boolean Scent sense to number
  if (typeof oldSenses?.sc === "boolean") {
    updateData["system.traits.senses.sc"] = oldSenses.sc ? 30 : 0;
  }
};

const _migrateActorSkillJournals = function (ent, updateData, linked) {
  const reOldJournalFormat = /^[a-zA-Z0-9]+$/;
  for (const [skillKey, skill] of Object.entries(ent.system.skills ?? {})) {
    for (const [subSkillKey, subSkill] of Object.entries(skill.subSkills ?? {})) {
      if (subSkill.journal?.match(reOldJournalFormat)) {
        updateData[`system.skills.${skillKey}.subSkills.${subSkillKey}.journal`] = `JournalEntry.${subSkill.journal}`;
      }
    }

    if (skill.journal?.match(reOldJournalFormat)) {
      updateData[`system.skills.${skillKey}.journal`] = `JournalEntry.${skill.journal}`;
    }
  }
};

const _migrateActorSubskillData = (actor, updateData) => {
  for (const [skillId, skillData] of Object.entries(actor.system.skills ?? {})) {
    for (const [subSkillId, subSkillData] of Object.entries(skillData.subSkills ?? {})) {
      if (subSkillData.mod !== undefined) {
        // Remove permanently stored .mod which is derived value
        // Added with PF1 v9
        updateData[`system.skills.${skillId}.subSkills.${subSkillId}.-=mod`] = null;
      }
    }
  }
};

const _migrateActorDRandER = function (ent, updateData) {
  const oldDR = ent.system.traits?.dr;
  const oldER = ent.system.traits?.eres;

  if (typeof oldDR === "string") {
    updateData["system.traits.dr"] = {
      value: [],
      custom: oldDR,
    };
  }

  if (typeof oldER === "string") {
    updateData["system.traits.eres"] = {
      value: [],
      custom: oldER,
    };
  }
};

const _Action_ConvertDamageType = function (damageTypeString) {
  const separator = /(?:\s*\/\s*|\s+and\s+|\s+or\s+)/i;
  const damageTypeList = [
    {
      tests: ["b", "blunt", "bludgeoning"],
      result: "bludgeoning",
    },
    {
      tests: ["p", "pierce", "piercing"],
      result: "piercing",
    },
    {
      tests: ["s", "slash", "slashing"],
      result: "slashing",
    },
    {
      tests: ["f", "fire"],
      result: "fire",
    },
    {
      tests: ["cold", "c"],
      result: "cold",
    },
    {
      tests: ["e", "electric", "electricity", "electrical"],
      result: "electric",
    },
    {
      tests: ["a", "acid"],
      result: "acid",
    },
    {
      tests: ["sonic"],
      result: "sonic",
    },
    {
      tests: ["force"],
      result: "force",
    },
    {
      tests: ["neg", "negative"],
      result: "negative",
    },
    {
      tests: ["pos", "positive"],
      result: "positive",
    },
    {
      tests: ["u", "untyped", "untype"],
      result: "untyped",
    },
  ];

  const damageTypes = damageTypeString.split(separator).map((o) => o.toLowerCase());
  const result = [];
  for (const damageTest of damageTypeList) {
    for (const testString of damageTest.tests) {
      if (damageTypes.includes(testString)) {
        result.push(damageTest.result);
      }
    }
  }

  if (result.length > 0) return result;
  return [];
};

/**
 * Filters out actions during migration.
 *
 * @param {object} action - The data of the action in question.
 * @returns {boolean} `true` to keep action, `false` to discard action.
 */
export const filterItemActions = function (action) {
  if (action.activation?.type) return true;
  if (action.actionType) return true;

  return false;
};

const _migrateContainerPrice = (item, updateData) => {
  if (item.type !== "container") return;

  // .basePrice was merged into .price with PF1 v9
  if (item.system.basePrice !== undefined) {
    updateData["system.price"] = item.system.basePrice;
    updateData["system.-=basePrice"] = null;
  }
  if (item.system.unidentified?.basePrice !== undefined) {
    updateData["system.unidentified.price"] = item.system.unidentified.basePrice;
    updateData["system.unidentified.-=basePrice"] = null;
  }
};

const _migrateItemType = function (ent, updateData) {
  const type = ent.type;
  const oldType = ent.system[`${type}Type`];
  if (oldType == null) return;
  updateData["system.subType"] = oldType;
  updateData[`system.-=${type}Type`] = null;
};

/**
 * Removes data that the system has added to items that is now unused with no new location.
 *
 * @param item
 * @param updateData
 */
const _migrateItemUnusedData = (item, updateData) => {
  // .priceUnits was never used, removal added with PF1 v9
  if (item.system.priceUnits !== undefined) {
    updateData["system.-=priceUnits"] = null;
  }

  // .description.chat was never used
  if (item.system.description?.chat !== undefined) {
    updateData["system.description.-=chat"] = null;
  }

  // .identifiedName was made obsolete with PF1 v9
  if (item.system.identifiedName !== undefined) {
    updateData["system.-=identifiedName"] = null;
  }

  // Creating items in containers added typeName for no reason (in 0.82.5 and older)
  if (item.system.typeName !== undefined) {
    updateData["system.-=typeName"] = null;
  }

  // Data not used since 0.81.0
  if (item.system.weaponData !== undefined) {
    updateData["system.-=weaponData"] = null;
  }

  // Data not used since 0.81.0
  if (item.system.range !== undefined) {
    updateData["system.-=range"] = null;
  }

  // Data not used since 0.81.0
  if (item.system.primaryAttack !== undefined) {
    updateData["system.-=primaryAttack"] = null;
  }

  // Data not used since 0.81.0
  if (item.system.activation !== undefined) {
    updateData["system.-=activation"] = null;
  }

  // Data not used since 0.81.0
  if (item.system.unchainedAction !== undefined) {
    updateData["system.-=unchainedAction"] = null;
  }

  // Data not used since 0.81.0
  if (item.system.measureTemplate !== undefined) {
    updateData["system.-=measureTemplate"] = null;
  }
};

const _migrateActorUnusedData = (actor, updateData) => {
  // Obsolete vision
  if (getProperty(actor.system, "attributes.vision") !== undefined) {
    updateData["system.attributes.-=vision"] = null;
  }

  if (getProperty(actor.prototypeToken, "flags.pf1.lowLightVision") !== undefined) {
    updateData["prototypeToken.flags.pf1.-=lowLightVision"] = null;
  }

  // XP max is purely derived value
  if (actor.system.details?.xp?.max !== undefined) {
    updateData["system.details.xp.-=max"] = null;
  }

  // Actor resources have always been derived data
  if (actor.system.resources !== undefined) {
    updateData["system.-=resources"] = null;
  }
};

/**
 * Flatten item tuple arrays
 * Since PF1 v9
 *
 * @param item
 * @param updateData
 */
const _migrateItemTuples = (item, updateData) => {
  // Race subtypes
  if (item.type === "race") {
    if (item.system.subTypes?.length) {
      if (typeof item.system.subTypes[0] !== "string") {
        updateData["system.subTypes"] = item.system.subTypes.flat();
      }
    }
  }

  // Tags
  if (item.system.tags?.length) {
    if (typeof item.system.tags[0] !== "string") {
      updateData["system.tags"] = item.system.tags.flat();
    }
  }

  // Feat class associations
  const classAssociations = item.system.associations?.classes;
  if (classAssociations?.length) {
    if (typeof classAssociations[0] !== "string") {
      updateData["system.associations.classes"] = classAssociations.flat();
    }
  }
};
