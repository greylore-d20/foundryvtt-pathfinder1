import { ItemPF } from "./documents/item/item-pf.mjs";
import { ItemChange } from "./components/change.mjs";

import { MigrationDialog } from "./applications/migration/migration-dialog.mjs";
import { MigrationState } from "./migration/migration-state.mjs";

/**
 * Moved compendium content.
 */
export const moved = {
  // Trapfinding (v10)
  "Compendium.pf1.class-abilities.OhHKCLQXoMlYNodk": "Compendium.pf1.class-abilities.Item.pEODJDoTk7uhCZY7",
  // Trap Sense (v10)
  "Compendium.pf1.class-abilities.fb00TzBa32sSisGb": "Compendium.pf1.class-abilities.Item.BoEkMviJrW0PKmhj",
  // Danger Sense (v10)
  "Compendium.pf1.class-abilities.4bcGnKYf9beV0nfa": "Compendium.pf1.class-abilities.Item.sTlu3zgAEDdJnER5",
  // Fast Movement (v10)
  "Compendium.pf1.class-abilities.dvQdP8QfrDA9Lxzk": "Compendium.pf1.class-abilities.Item.9EX00obqhGHcrOdp",
};

const marker = () => ({ pf1: { action: "migration" } });

/**
 * An indicator for whether the system is currently migrating the world.
 *
 * @type {boolean}
 */
// As the `pf1` global does not use this ES module but a cloned copy, this value
// only exists for the documentation. Always use `pf1.migrations.isMigrating` instead!
export let isMigrating = false; // eslint-disable-line prefer-const -- pf1.migrations.isMigrating is changed at runtime

/**
 * Initialize {@link MigrationState} and {@link MigrationDialog}
 *
 * @param {MigrationState} [state] - State tracker
 * @param {string} [label] - Label
 * @param {object} [dialog=null] - If falsy, disable dialog. Otherwise options for the dialog.
 * @returns {MigrationState} - Original state or newly initialized one.
 */
function initializeStateAndDialog(state, label, dialog = null) {
  state ??= new MigrationState(label);
  if (dialog) MigrationDialog.initialize(state, label, dialog);
  return state;
}

/**
 * Perform a system migration for the entire World,
 * applying migrations for Actors, Items, Scenes, Tokens and Compendium packs
 *
 * @param {object} [options={}] - Additional options
 * @param {boolean} [options.unlock=false] - If false, locked compendiums are ignored.
 * @param {boolean} [options.systemPacks=false] - Migrate system packs.
 * @param {MigrationState} [options.state] - Migration state tracker
 * @param {object} [options.dialog={}] - Progress dialog options. Set to falsy to disable the dialog.
 * @returns {Promise<void>} - A Promise which resolves once the migration is completed
 */
export async function migrateWorld({ unlock = false, systemPacks = false, state, dialog = {} } = {}) {
  const isGM = game.user.isGM;

  // Deny migration if migration is in progress and there's an active GM,
  // otherwise assume it's an error and allow migration to start anew.
  // Don't check for the setting to avoid migration state getting stuck, only trust the in-memory state
  if (pf1.migrations.isMigrating && game.users.activeGM) {
    return void ui.notifications.error(game.i18n.localize("PF1.Migration.InProgress"));
  }

  if (isGM) await game.settings.set("pf1", "migrating", true);

  pf1.migrations.isMigrating = true;
  Hooks.callAll("pf1MigrationStarted", { scope: "world" });

  state = initializeStateAndDialog(state, "PF1.Migration.Category.World", dialog);
  state.unlock = unlock;

  state.start();

  const startMessage = game.i18n.format("PF1.Migration.Start", { version: game.system.version });
  const smsgId = ui.notifications.info(startMessage, { permanent: true, console: false });
  console.log("PF1 | Migration | Starting...");

  if (isGM) {
    await _migrateWorldSettings();
  }

  // Migrate World Actors
  await migrateActors({ state, noHooks: true });

  // Migrate World Items
  await migrateItems({ state, noHooks: true });

  // Migrate Actor Override Tokens
  await migrateScenes({ state, noHooks: true });

  if (isGM) {
    // Migrate Compendium Packs
    const packs = game.packs.filter((p) => {
      const source = p.metadata.packageType;
      // Ignore modules, adventures, etc.
      if (!["world", "system"].includes(source)) return false;
      // Ignore system packs unless configured to include them
      if (source === "system" && !systemPacks) return false;
      // Ignore unsupported pack types
      return ["Actor", "Item", "Scene"].includes(p.metadata.type);
    });

    await migrateCompendiums(packs, { unlock, state, noHooks: true });
  }

  // Remove start message
  ui.notifications.remove(smsgId);

  // Remove migration notification
  ui.notifications.info(game.i18n.format("PF1.Migration.End", { version: game.system.version }), { console: false });
  console.log("PF1 | Migration | Completed!");

  if (isGM) {
    // Set the migration as complete
    await game.settings.set("pf1", "systemMigrationVersion", game.system.version);

    await game.settings.set("pf1", "migrating", false);
  }

  state.finish();

  Hooks.callAll("pf1MigrationFinished", { scope: "world" });
}

/**
 * Migrate actors directory.
 *
 * @param {object} [options={}]
 * @param {MigrationState} [options.state]
 * @param {object} [options.dialog=null]
 * @param options.noHooks
 * @returns {Promise<void>}
 */
export async function migrateActors({ state, dialog = null, noHooks = false } = {}) {
  if (!noHooks) Hooks.callAll("pf1MigrationStarted", { scope: "actors" });

  // Locally generated state tracker
  const localState = !state;
  state ??= initializeStateAndDialog(state, "PF1.Migration.Category.Actors", dialog);

  if (localState) state.start();

  const tracker = state.createCategory("actors", "PF1.Migration.Category.Actors", true);

  console.log("PF1 | Migration | Actors directory starting...");
  tracker.start();

  tracker.setTotal(game.actors.size);
  tracker.setInvalid(game.actors.invalidDocumentIds.size);

  for (const actor of game.actors) {
    if (!actor.isOwner) {
      tracker.ignoreEntry(actor);
      continue;
    }

    tracker.startEntry(actor);

    try {
      const updateData = await migrateActorData(actor.toObject(), undefined, { actor });
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`PF1 | Migration | Actor: ${actor.name} | Applying updates`);
        await actor.update(updateData, marker());
      }
    } catch (err) {
      tracker.recordError(actor, err);
      console.error(`PF1 | Migration | Actor: ${actor.name} | Error`, err);
    }
    tracker.finishEntry(actor);
  }

  console.log("PF1 | Migration | Actors directory complete!");
  tracker.finish();
  if (localState) state.finish();

  if (!noHooks) Hooks.callAll("pf1MigrationFinished", { scope: "actors" });
}

/**
 * Migrate items directory.
 *
 * @param {object} [options={}]
 * @param {MigrationState} [options.state]
 * @param {object} [options.dialog=null]
 * @param options.noHooks
 * @returns {Promise<void>}
 */
export async function migrateItems({ state, dialog = null, noHooks = false } = {}) {
  if (!noHooks) Hooks.callAll("pf1MigrationStarted", { scope: "items" });

  // Locally generated state tracker
  const localState = !state;
  state ??= initializeStateAndDialog(state, "PF1.Migration.Category.Items", dialog);

  if (localState) state.start();

  const tracker = state.createCategory("items", "PF1.Migration.Category.Items", true);

  console.log("PF1 | Migration | Items directory starting...");
  tracker.start();

  tracker.setTotal(game.items.size);
  tracker.setInvalid(game.items.invalidDocumentIds.size);

  for (const item of game.items) {
    if (!item.isOwner) {
      tracker.ignoreEntry(item);
      continue;
    }

    tracker.startEntry(item);

    try {
      const updateData = await migrateItemData(item.toObject());
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`PF1 | Migration | Item: ${item.name} | Applying updates`);
        await item.update(updateData, marker());
      }
    } catch (err) {
      tracker.recordError(item, err);
      console.error(`PF1 | Migration | Item: ${item.name} | Error`, err);
    }
    tracker.finishEntry(item);
  }

  tracker.finish();
  if (localState) state.finish();
  console.log("PF1 | Migration | Items directory complete!");

  if (!noHooks) Hooks.callAll("pf1MigrationFinished", { scope: "items" });
}

/**
 * Migrate all scenes.
 *
 * @see {@link migrateScene}
 *
 * @param {object} [options={}]
 * @param {MigrationState} [options.state]
 * @param options.noHooks
 * @param {object} [options.dialog=null]
 *
 * @returns {Promise<void>}
 */
export async function migrateScenes({ state, noHooks = false, dialog = null } = {}) {
  if (!noHooks) Hooks.callAll("pf1MigrationStarted", { scope: "scenes" });

  // Locally generated state tracker
  const localState = !state;
  state ??= initializeStateAndDialog(state, "PF1.Migration.Category.Scenes", dialog);

  if (localState) state.start();

  const tracker = state.createCategory("scenes", "PF1.Migration.Category.Scenes", true);

  console.log("PF1 | Migration | Scene directory starting...");
  tracker.start();

  tracker.setTotal(game.scenes.size);
  tracker.setInvalid(game.scenes.invalidDocumentIds.size);

  for (const scene of game.scenes) {
    tracker.startEntry(scene);
    await migrateScene(scene, { state, tracker });
    tracker.finishEntry(scene);
  }

  tracker.finish();

  if (localState) state.finish();
  console.log("PF1 | Migration | Scene directory complete!");

  if (!noHooks) Hooks.callAll("pf1MigrationFinished", { scope: "scenes" });
}

/**
 * Migrate compendiums.
 *
 * @see {@link migrateCompendium}
 *
 * @param {Array<string|WorldCollection>|null} [packIds=null] - Array of pack IDs or packs to migrate. If null, all packs will be migrated.
 * @param {object} [options={}] - Additional options to pass along.
 * @param {boolean} [options.unlock=false] - If false, locked compendiums are ignored.
 * @param options.noHooks
 * @param {MigrationState} [options.state] - Migration state tracker
 * @param {object} [options.dialog=null] - Display migration dialog. Falsy disables.
 * @returns {Promise<void>} - Promise that resolves once all migrations are complete.
 * @throws {Error} - If defined pack is not found.
 */
export async function migrateCompendiums(
  packIds = null,
  { unlock = false, state, noHooks = false, dialog = null } = {}
) {
  if (!noHooks) Hooks.callAll("pf1MigrationStarted", { scope: "packs", packs: foundry.utils.deepClone(packIds) });

  if (packIds === null) packIds = [...game.packs];

  // Locally generated state tracker
  const localState = !state;
  if (dialog) state = initializeStateAndDialog(state, "PF1.Migration.Category.Packs", dialog);
  if (state) state.unlock = unlock;

  if (localState) state?.start();

  const tracker = state?.createCategory("packs", "PF1.Migration.Category.Packs", true);
  tracker?.start();
  tracker?.setTotal(packIds.length);

  for (const pack of packIds) {
    tracker?.startEntry(pack);

    if (!unlock && pack.locked) tracker?.ignoreEntry(pack);

    try {
      await migrateCompendium(pack, { unlock, noHooks: true });
    } catch (error) {
      console.error(`PF1 | Migration | Pack: ${pack.collection} | Error`, error);
    }

    tracker?.finishEntry(pack);
  }

  tracker?.finish();
  if (localState) state?.finish();

  if (!noHooks) Hooks.callAll("pf1MigrationFinished", { scope: "packs", packs: foundry.utils.deepClone(packIds) });
}

/**
 * Migrate system compendia.
 *
 * Convenience wrapper for migrateCompendiums.
 *
 * @see {@link migrateCompendiums}
 *
 * @param {object} [options={}] - Additional options
 * @param {boolean} [options.unlock] - Unlock compendiums
 * @param {MigrationState} [options.state]
 * @param {object} [options.dialog={}] - Migration dialog options. Falsy disables the dialog.
 * @returns {Promise<void>}
 */
export async function migrateSystem({ unlock = true, state, dialog = {} } = {}) {
  Hooks.callAll("pf1MigrationStarted", { scope: "system" });

  state ??= initializeStateAndDialog(state, "PF1.Migration.Category.System", dialog);
  state.unlock = unlock;

  state.start();

  const packs = game.packs.filter((p) => p.metadata.packageType === "system");
  await migrateCompendiums(packs, { unlock, state, dialog: false, noHooks: true });

  state.finish();

  Hooks.callAll("pf1MigrationFinished", { scope: "system" });
}

/**
 * Migrate module compendia.
 *
 * Convenience wrapper for migrateCompendiums.
 *
 * @see {@link migrateCompendiums}
 *
 * @param {object} [options={}] - Additional options
 * @param {boolean} [options.unlock] - Unlock compendiums
 * @param {object} [options.dialog={}] - Dialog options. Falsy disables the dialog.
 * @param {MigrationState} [options.state]
 * @returns {Promise<void>}
 */
export async function migrateModules({ unlock = true, state, dialog = {} } = {}) {
  Hooks.callAll("pf1MigrationStarted", { scope: "modules" });

  state ??= initializeStateAndDialog(state, "PF1.Migration.Category.Modules", dialog);
  state.unlock = unlock;

  state.start();

  const packs = game.packs.filter((p) => p.metadata.packageType === "module");
  await migrateCompendiums(packs, { unlock, state, noHooks: true });

  state.finish();

  Hooks.callAll("pf1MigrationFinished", { scope: "modules" });
}

/* -------------------------------------------- */

/**
 * Clear messages generated by pack.migrate()
 *
 * @internal
 * @param {string} marker - string to look for
 */
function clearCoreMessages(marker) {
  const testActiveMsg = (el, marker) => {
    if (el instanceof jQuery) el = el[0];
    return el.textContent.includes(marker);
  };
  // Queue has special objects
  ui.notifications.queue = ui.notifications.queue.filter((msg) => !msg.message.includes(marker));
  // Active has jQuery elements
  ui.notifications.active = ui.notifications.active.filter((msg) => !testActiveMsg(msg));
  ui.notifications.fetch();
}

/**
 * Apply migration rules to all Documents within a single Compendium pack
 *
 * @param {CompendiumCollection|string} pack - Compendium (or its ID) to migrate
 * @param {object} [options={}] - Additional options
 * @param {boolean} [options.unlock=false] - If false, locked compendium will be ignored.
 * @param options.noHooks
 * @returns {Promise<void>} - Promise that resolves once migration is complete.
 * @throws {Error} - If defined pack is not found.
 */
export async function migrateCompendium(pack, { unlock = false, noHooks = false } = {}) {
  if (typeof pack === "string") {
    pack = game.packs.get(pack);
    if (!pack) throw new Error(`Compendium "${pack}" not found.`);
  }

  if (pack.locked && !unlock) return;

  const docType = pack.metadata.type;
  if (!["Actor", "Item", "Scene"].includes(docType)) return;

  if (!noHooks) Hooks.callAll("pf1MigrationStarted", { scope: "pack", collection: pack });

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  // Begin by requesting server-side data model migration and get the migrated content
  await pack.migrate();
  clearCoreMessages(`Compendium pack ${pack.collection}`);

  // Iterate over compendium entries - applying fine-tuned migration functions
  console.log(`PF1 | Migration | Pack: ${pack.collection} | Starting...`);

  /** @type {Actor[]|Scene[]|Item[]} */
  console.debug(`PF1 | Migration | Pack: ${pack.collection} | Requesting documents from server`);
  const documents = await pack.getDocuments();

  const updates = [];

  console.debug(
    `PF1 | Migration | Pack: ${pack.collection} | Building update data for ${documents.length} document(s)`
  );
  // Collect updates
  for (const document of documents) {
    try {
      let updateData;
      switch (docType) {
        case "Item":
          updateData = await migrateItemData(document.toObject(), undefined, { item: document });
          break;
        case "Actor":
          updateData = await migrateActorData(document.toObject(), undefined, { actor: document });
          break;
        case "Scene": {
          await migrateScene(document);
          break;
        }
      }

      if (updateData && !foundry.utils.isEmpty(updateData)) {
        updateData._id = document.id;
        updates.push(updateData);
      }
    } catch (err) {
      console.error(`PF1 | Migration | Pack: ${pack.collection} | Error!`, err);
    }
  }

  if (updates.length) {
    console.debug(`PF1 | Migration | Pack: ${pack.collection} | Applying update(s) to ${updates.length} document(s)`);
    // Commit updates
    try {
      await getDocumentClass(docType).updateDocuments(updates, { pack: pack.collection, ...marker() });
    } catch (err) {
      console.error(`PF1 | Migration | Pack: ${pack.collection} | Error:`, err);
    }
  } else {
    console.debug(`PF1 | Migration | Pack: ${pack.collection} | No updates needed`);
  }

  if (wasLocked) await pack.configure({ locked: true });

  if (!noHooks) Hooks.callAll("pf1MigrationFinished", { scope: "pack", collection: pack });

  console.log(`PF1 | Migration | Pack: ${pack.collection} | Migration complete!`);
}

/**
 * Migrates world settings.
 */
async function _migrateWorldSettings() {
  const tooltipWorldConfig = game.settings.get("pf1", "tooltipWorldConfig");
  if (tooltipWorldConfig.hideActorName !== undefined) {
    // 1 (All) for true, -2 (None) for false
    tooltipWorldConfig.hideActorNameByDisposition == tooltipWorldConfig.hideActorName ? 1 : -2;
    game.settings.set("pf1", "tooltipWorldConfig", tooltipWorldConfig);
  }
}

/* -------------------------------------------- */
/*  Document Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate data in tokens that is no longer used.
 *
 * @param {object} tokenData Token data
 * @param {object} [options] - Additional options
 * @param {TokenDocument} [options.token] - Token document
 */
export async function migrateTokenData(tokenData, { token }) {
  const flags = tokenData.flags?.pf1 ?? {};

  const updateData = {};

  // Remove obsolete flags
  if (flags.lowLightVision !== undefined) {
    updateData["flags.pf1.-=lowLightVision"] = null;
  }
  if (flags.lowLightVisionMultiplier !== undefined) {
    updateData["flags.pf1.-=lowLightVisionMultiplier"] = null;
  }
  if (flags.lowLightVisionMultiplierBright !== undefined) {
    updateData["flags.pf1.-=lowLightVisionMultiplierBright"] = null;
  }

  // Remove disabled but still in use flags
  if (flags.disableLowLight === false) {
    updateData["flags.pf1.-=disableLowLight"] = null;
  }
  if (flags.staticSize === false) {
    updateData["flags.pf1.-=staticSize"] = null;
  }
  if (flags.customVisionRules === false) {
    updateData["flags.pf1.-=customVisionRules"] = null;
  }

  // Remove data from v9 vision handling
  // Added with PF1 v9.4
  if (!flags.customVisionRules) {
    // Attempt to preserve vision range after migration
    if (tokenData.sight.visionMode !== "basic") {
      if (tokenData.sight.range !== 0) updateData["sight.range"] = 0;
      updateData["sight.visionMode"] = "basic";
    }
    if ("saturation" in tokenData.sight) updateData["sight.-=saturation"] = null;
    if ("brightness" in tokenData.sight) updateData["sight.-=brightness"] = null;
    if ("attenuation" in tokenData.sight) updateData["sight.-=attenuation"] = null;
    if ("contrast" in tokenData.sight) updateData["sight.-=contrast"] = null;
    if (tokenData.detectionModes?.length) updateData["detectionModes"] = [];
  }

  // Record migrated version
  if (!foundry.utils.isEmpty(updateData)) {
    updateData["flags.pf1.migration"] = game.system.version;
  }

  return updateData;
}

/**
 * Migrate token.
 *
 * @param {TokenDocument} token - Token to migrate
 * @returns {Promise<TokenDocument|null>} - Promise to updated document,. or null if no update was done.
 */
export async function migrateToken(token) {
  const tokenData = token.toObject();
  const updateData = await migrateTokenData(tokenData, { token });
  if (!foundry.utils.isEmpty(updateData)) {
    return token.update(foundry.utils.expandObject(updateData), marker());
  }
}

/**
 * Migrate singular actor document.
 *
 * @param {Actor} actor - Actor to migrate.
 * @returns {Promise<Actor|null>}
 */
export async function migrateActor(actor) {
  await migrateActiveEffectsToItems(actor);

  const updateData = await migrateActorData(actor.toObject(), actor.token, { actor });
  if (!foundry.utils.isEmpty(updateData)) {
    return actor.update(updateData, marker());
  }

  return null;
}

/**
 * Migrate active effects from actor to items that should own them instead.
 *
 * Added with PF1 v10
 *
 * @param {ActorPF} actor
 */
export async function migrateActiveEffectsToItems(actor) {
  const p = [];
  for (const buff of actor.itemTypes.buff) {
    if (!buff.isActive) continue;
    try {
      const ae = buff.effect;
      if (!ae) continue;
      if (ae.parent === buff) continue; // Already migrated

      const aeData = ae.toObject();
      setProperty(aeData, "flags.pf1.tracker", true);
      aeData.transfer = true;

      const p0 = ActiveEffect.implementation.create(aeData, { parent: buff });
      const p1 = ae.delete();
      p.push(p0, p1);
    } catch (err) {
      console.error("PF1 | Migration | Failed to transition buff tracker to origin", err);
    }
  }

  await Promise.all(p);
}

/**
 * Migrate a single Actor document to incorporate latest data model changes
 * Return an Object of updateData to be applied
 *
 * @param {ActorData} actorData   The actor data to derive an update from
 * @param {TokenDocument} token
 * @param {object} [options] - Additional options
 * @param {Actor} [options.actor] - Associated actor document
 * @returns {object} - The updateData to apply
 */
export async function migrateActorData(actorData, token, { actor } = {}) {
  // Ignore basic actor type
  if (actorData.type === "basic") return {};
  // Ignore module introduced types
  if (!game.system.template.Actor.types.includes(actorData.type)) return {};

  const updateData = {};

  _migrateCharacterLevel(actorData, updateData);
  _migrateActorEncumbrance(actorData, updateData);
  _migrateActorNoteArrays(actorData, updateData);
  _migrateActorSpeed(actorData, updateData);
  _migrateActorSpellbookCL(actorData, updateData);
  _migrateActorSpellbookSlots(actorData, updateData);
  _migrateActorSpellbookPrep(actorData, updateData);
  _migrateActorSpellbookKind(actorData, updateData, actor);
  _migrateActorConcentration(actorData, updateData);
  _migrateActorBaseStats(actorData, updateData);
  _migrateUnusedActorCreatureType(actorData, updateData);
  _migrateActorSpellbookDCFormula(actorData, updateData);
  _migrateActorHPAbility(actorData, updateData);
  _migrateActorCR(actorData, updateData);
  _migrateAttackAbility(actorData, updateData);
  _migrateActorDefenseAbility(actorData, updateData);
  _migrateActorSpellbookUsage(actorData, updateData);
  _migrateActorNullValues(actorData, updateData);
  _migrateActorSpellbookDomainSlots(actorData, updateData);
  _migrateActorStatures(actorData, updateData);
  _migrateActorProficiencies(actorData, updateData, { actor });
  _migrateActorInitAbility(actorData, updateData);
  _migrateActorChangeRevamp(actorData, updateData);
  _migrateActorCMBRevamp(actorData, updateData);
  _migrateCarryBonus(actorData, updateData);
  _migrateBuggedValues(actorData, updateData);
  _migrateSpellbookUsage(actorData, updateData);
  _migrateActorHP(actorData, updateData);
  _migrateActorSenses(actorData, updateData, token);
  _migrateActorInvaliddSkills(actorData, updateData);
  _migrateActorSkillRanks(actorData, updateData);
  _migrateActorSkillJournals(actorData, updateData);
  _migrateActorSubskillData(actorData, updateData);
  _migrateActorUnusedData(actorData, updateData);
  _migrateActorDRandER(actorData, updateData);
  _migrateActorTraitsCustomToArray(actorData, updateData);
  _migrateActorFlags(actorData, updateData);

  // Migrate Owned Items
  const items = [];
  for (const item of actorData.items ?? []) {
    // Migrate the Owned Item
    const itemData = item instanceof Item ? item.toObject() : item;
    const itemUpdate = await migrateItemData(itemData, actor, { item: actor?.items.get(itemData._id) });

    // Update the Owned Item
    if (!foundry.utils.isEmpty(itemUpdate)) {
      itemUpdate._id = itemData._id;
      items.push(foundry.utils.expandObject(itemUpdate));
    }
  }
  if (items.length > 0) updateData.items = items;

  // Active Effects
  await _migrateActorActiveEffects(actorData, updateData, actor);

  // Record migrated version
  if (!foundry.utils.isEmpty(updateData)) {
    updateData["flags.pf1.migration"] = game.system.version;
  }

  return foundry.utils.expandObject(updateData);
}

/* -------------------------------------------- */

/**
 *  Migrate singular item document.
 *
 * @param {Item} item - Item document to update.
 * @returns {Promise<Item|null>} - Promise to updated item document, or null if no update was performed.
 */
export async function migrateItem(item) {
  const updateData = await migrateItemData(item.toObject(), item.actor, { item });
  if (!foundry.utils.isEmpty(updateData)) {
    return item.update(updateData, marker());
  }
  return null;
}

/**
 * Migrate a single Item document to incorporate latest data model changes
 *
 * @param {object} itemData    The item data to derive an update from
 * @param {Actor} actor - Parent actor document
 * @param {object} [options] - Additional options
 * @param {number} [options._depth=0] - Internal only. Recursion depth tracking.
 * @param {Item} [options.item] - Item document
 * @returns {object} - The updateData to apply
 */
export async function migrateItemData(itemData, actor = null, { item, _depth = 0 } = {}) {
  const updateData = {};

  // Migrate data to system
  if (itemData.system == null && itemData.data != null) {
    itemData = foundry.utils.deepClone(itemData);
    itemData.system = itemData.data;
    delete itemData.data;
  }

  // Ignore module introduced types
  if (!game.system.template.Item.types.includes(itemData.type)) return {};

  _migrateItemArrayTypes(itemData, updateData);
  _migrateFlagsArrayToObject(itemData, updateData);
  _migrateWeaponImprovised(itemData, updateData);
  _migrateItemSpellDescription(itemData, updateData);
  _migrateClassDynamics(itemData, updateData);
  _migrateClassType(itemData, updateData);
  _migrateClassCasting(itemData, updateData);
  _migrateSpellDivineFocus(itemData, updateData);
  _migrateWeaponCategories(itemData, updateData);
  _migrateArmorCategories(itemData, updateData);
  _migrateArmorMaxDex(itemData, updateData);
  _migrateItemSize(itemData, updateData);
  _migrateItemFeatAbilityTypes(itemData, updateData);
  _migrateClassLevels(itemData, updateData);
  _migrateSavingThrowTypes(itemData, updateData);
  _migrateCR(itemData, updateData);
  _migrateItemChanges(itemData, updateData);
  _migrateItemChangeFlags(itemData, updateData);
  _migrateItemContextNotes(itemData, updateData);
  _migrateEquipmentSize(itemData, updateData);
  _migrateSpellCosts(itemData, updateData);
  _migrateSpellPreparation(itemData, updateData, { item });
  _migrateLootEquip(itemData, updateData);
  _migrateItemLinks(itemData, updateData, { item, actor });
  _migrateItemProficiencies(itemData, updateData);
  _migrateItemNotes(itemData, updateData);
  _migrateScriptCalls(itemData, updateData);
  _migrateItemActions(itemData, updateData, actor);
  _migrateItemChargeCost(itemData, updateData);
  _migrateItemLimitedUses(itemData, updateData);
  _migrateItemWeight(itemData, updateData);
  _migrateItemHealth(itemData, updateData);
  _migrateContainerReduction(itemData, updateData);
  _migrateContainerPrice(itemData, updateData);
  _migrateItemType(itemData, updateData);
  _migrateItemLearnedAt(itemData, updateData);
  _migrateItemTuples(itemData, updateData);
  _migrateEquipmentCategories(itemData, updateData);
  _migrateSpellDescriptors(itemData, updateData);
  _migrateItemTraitsCustomToArray(itemData, updateData);
  _migrateItemChangeFlags(itemData, updateData);
  _migrateItemMaterials(itemData, updateData);
  _migrateItemUnusedData(itemData, updateData);

  // Migrate action data
  const alreadyHasActions = itemData.system.actions instanceof Array && itemData.system.actions.length > 0;
  const itemActionData = alreadyHasActions ? itemData.system.actions : updateData["system.actions"];
  if (itemActionData instanceof Array) {
    const newActionData = itemActionData.map((action) => migrateItemActionData(action, updateData, { itemData, item }));
    // Update only if something changed. Bi-directional testing for detecting deletions.
    if (
      !foundry.utils.isEmpty(foundry.utils.diffObject(itemActionData, newActionData)) ||
      !foundry.utils.isEmpty(foundry.utils.diffObject(newActionData, itemActionData))
    ) {
      updateData["system.actions"] = newActionData;
    }
  }

  // Migrate container .inventoryItems array to .items map
  // Introduced with PF1 v10
  if (itemData.system?.inventoryItems instanceof Array) {
    updateData["system.items"] = {};
    for (const sitem of itemData.system.inventoryItems) {
      sitem._id ||= foundry.utils.randomID(16);

      // Deal with corrupt items or v9 or older items
      sitem.system ??= {};
      try {
        if ("data" in sitem) {
          sitem.system = foundry.utils.mergeObject(sitem.data, sitem.system, { inplace: false });
          delete sitem.data;
        }

        const subItem = new Item.implementation(sitem);

        const itemUpdateData = await migrateItemData(subItem.toObject(), actor, { _depth: _depth + 1 });
        subItem.updateSource(itemUpdateData);

        updateData["system.items"][sitem._id] = subItem.toObject();
      } catch (err) {
        console.error("Failed to migrate container content:", { item: sitem, parent: item, actor });
      }
    }

    updateData["system.-=inventoryItems"] = null;
  }

  // Migrate container items
  const migrateContainerItems = async (items) => {
    if (!items) return;
    for (const [itemId, itemData] of Object.entries(items)) {
      try {
        // Basic validation
        const subItem = new Item.implementation(itemData);

        // Migrate
        const subUpdate = await migrateItemData(subItem.toObject(), actor, { item: subItem, _depth: _depth + 1 });

        if (!foundry.utils.isEmpty(subUpdate)) {
          const diff = subItem.updateSource(subUpdate);
          updateData["system.items"] ??= {};
          updateData["system.items"][itemId] = diff;
        }
      } catch (err) {
        console.error("PF1 | Migration | Error", err, item);
      }
    }
  };

  await migrateContainerItems(itemData.system.items);

  // Record migrated version
  if (!foundry.utils.isEmpty(updateData)) {
    updateData["flags.pf1.migration"] = game.system.version;
  }

  // Return the migrated update data
  return updateData;
}

// Migrate empty action type to "other"
// Added with PF1 v10
const _migrateActionType = (action, itemData) => {
  action.actionType ||= "other";
};

// Added with PF1 v10
const _migrateActionLimitedUses = (action, itemData) => {
  // Migrate unlimited to empty selection, as the two are identical in meaning
  if (action.uses?.self?.per === "unlimited") {
    delete action.uses.self.per;
  }

  // Only physical items can be single use
  const isPhysical = CONFIG.Item.documentClasses[itemData.type]?.isPhysical;
  if (!isPhysical) {
    if (action.uses?.self?.per === "single") {
      action.uses.self.per = "charges";
      action.uses.self.maxFormula = "1";
    }
  }
};

/**
 * Older actors incorrectly has .range.value as number instead of string
 *
 * @param {object} action - Action data
 * @param {object} itemData - Parent item data
 */
const _migrateActionRange = (action, itemData) => {
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
 * @param {object} updateData - Item update data
 * @param {object} [options] - Additional options
 * @param {Item} [options.item=null] - Parent item document this action is in.
 * @param {object} options.itemData - Parent item data
 * @returns {object} The resulting action data.
 */
export const migrateItemActionData = function (action, updateData, { itemData, item = null } = {}) {
  action = foundry.utils.mergeObject(pf1.components.ItemAction.defaultData, action);

  _migrateActionType(action, itemData);
  _migrateActionLimitedUses(action, itemData);
  _migrateActionRange(action, itemData);
  _migrateActionDamageParts(action, itemData);
  _migrateUnchainedActionEconomy(action, itemData);
  _migrateActionDamageType(action, itemData);
  _migrateActionConditionals(action, itemData);
  _migrateActionEnhOverride(action, itemData);
  _migrateActionPrimaryAttack(action, itemData);
  _migrateActionChargeUsage(action, itemData);
  _migrateActionExtraAttacks(action, itemData);
  _migrateActionAmmunitionUsage(action, itemData, updateData);
  _migrateActionHarmlessSpell(action, itemData);
  _migrateActionSpellArea(action, itemData);
  _migrateActionTemplate(action, itemData);
  _migrateActionDuration(action, itemData);
  _migrateActionObsoleteTypes(action, itemData);
  _migrateActionUnusedData(action, itemData);

  // Return the migrated update data
  return action;
};

/* -------------------------------------------- */

/**
 * Migrate singular scene document.
 *
 * @param {Scene} scene - Scene document to update.
 * @param {object} [options] - Additional options
 * @param {MigrationState} [options.state=null]
 * @param {MigrationCategory} [options.tracker=null]
 * @returns {Promise<void>}
 */
export async function migrateScene(scene, { state, tracker } = {}) {
  console.log(`PF1 | Migration | Scene: ${scene.name} | Starting...`);
  try {
    await migrateSceneTokens(scene, { state, tracker });
    await migrateSceneActors(scene, { state, tracker });

    // Mark last migrated version
    if (game.user.isGM) await scene.setFlag("pf1", "migration", game.system.version);
  } catch (err) {
    tracker?.recordError(scene, err);
    console.error(`PF1 | Migration | Scene: ${scene.name} | Error`, err);
  }
  console.log(`PF1 | Migration | Scene: ${scene.name} | Complete!`);
}

/**
 * Migrate a single Scene data object
 *
 * @deprecated
 */
export async function migrateSceneData() {
  foundry.utils.logCompatibilityWarning(
    "pf1.migrations.migrateSceneData() is obsolete, please use pf1.migrations.migrateScene() instead",
    {
      since: "PF1 v10",
      until: "PF1 v11",
    }
  );
  return {};
}

/**
 * Migrate tokens in a single scene.
 *
 * @param {Scene} scene - The Scene to Update
 * @param {object} [options] - Additional options
 * @param {MigrationState} [options.state=null]
 * @param {MigrationCategory} [options.tracker=null]
 */
export async function migrateSceneTokens(scene, { state = null, tracker = null } = {}) {
  for (const token of scene.tokens) {
    if (!token.isOwner) continue;

    try {
      await migrateToken(token);
    } catch (err) {
      tracker?.recordError(token, err);
      console.error(`PF1 | Migration | Scene: ${scene.name} | Token: ${token.id} | Error`, token, err);
    }
  }
}

/**
 * Migrate unlinked actors on a single scene.
 *
 * @param {Scene} scene - Scene to migrate actors in.
 * @param {object} [options] - Additional options
 * @param {MigrationState} [options.state=null]
 * @param {MigrationCategory} [options.tracker=null]
 * @returns {Promise<void>}
 */
export async function migrateSceneActors(scene, { state = null, tracker = null } = {}) {
  for (const token of scene.tokens) {
    if (token.isLinked) continue;
    const actor = token.actor;
    if (!actor?.isOwner) continue;

    try {
      const updateData = await migrateActorData(actor.toObject(), token, { actor });
      if (!foundry.utils.isEmpty(updateData)) {
        const items = updateData.items;
        delete updateData.items;
        const effects = updateData.effects;
        delete updateData.effects;
        if (!foundry.utils.isEmpty(updateData)) await actor.update(updateData, marker());
        if (items?.length) await actor.updateEmbeddedDocuments("Item", items, marker());
        if (effects?.length) await actor.updateEmbeddedDocuments("ActiveEffect", effects, marker());
      }
    } catch (err) {
      tracker?.recordError(token, err);
      console.error(`PF1 | Migration | Scene: ${scene.name} | Token: ${token.id} | Error`, token, err);
    }
  }
}

/* -------------------------------------------- */

const _migrateCharacterLevel = function (ent, updateData) {
  const arr = ["details.level.value", "details.level.min", "details.level.max", "details.mythicTier"];

  for (const k of arr) {
    const value = foundry.utils.getProperty(ent.system, k);
    if (value == null) {
      updateData["system." + k] = 0;
    }
  }
};

const _migrateActorEncumbrance = function (ent, updateData) {
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
    const value = foundry.utils.getProperty(ent, key);
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
    const value = foundry.utils.getProperty(ent, k);
    const hasValue = foundry.utils.hasProperty(ent, k);
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
  for (const k of arr) {
    let value = foundry.utils.getProperty(ent.system, k);
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
    if (k === "attributes.speed.fly" && foundry.utils.getProperty(ent.system, `${k}.maneuverability`) === undefined) {
      updateData[`system.${k}.maneuverability`] = "average";
    }
  }
};

const _migrateActorSpellbookSlots = function (ent, updateData) {
  for (const spellbookSlot of Object.keys(
    foundry.utils.getProperty(ent.system, "attributes.spells.spellbooks") || {}
  )) {
    if (
      foundry.utils.getProperty(ent.system, `attributes.spells.spellbooks.${spellbookSlot}.autoSpellLevels`) == null
    ) {
      updateData[`system.attributes.spells.spellbooks.${spellbookSlot}.autoSpellLevels`] = true;
    }

    for (let a = 0; a < 10; a++) {
      const baseKey = `system.attributes.spells.spellbooks.${spellbookSlot}.spells.spell${a}.base`;
      const maxKey = `system.attributes.spells.spellbooks.${spellbookSlot}.spells.spell${a}.max`;
      const base = foundry.utils.getProperty(ent, baseKey);
      const max = foundry.utils.getProperty(ent, maxKey);

      if (base === undefined) {
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

// Remove inconsistently used .spontaneous permanently recorded boolean
// Added with PF1 v10
function _migrateActorSpellbookPrep(actorData, updateData) {
  for (const [bookId, book] of Object.entries(
    foundry.utils.getProperty(actorData.system, "attributes.spells.spellbooks") || {}
  )) {
    const wasSpontaneous = book.spontaneous;
    if (wasSpontaneous === undefined) continue;

    const usesAuto = book.autoSpellLevelCalculation ?? false;
    const usesSpellpoints = book.spellPoints.useSystem === true;
    if (!usesAuto && !usesSpellpoints) {
      // Set prep type to match old spontaneous toggle
      updateData[`system.attributes.spells.spellbooks.${bookId}.spellPreparationMode`] = wasSpontaneous
        ? "spontaneous"
        : "prepared";

      // Set progression type to high to match old behaviour
      updateData[`system.attributes.spells.spellbooks.${bookId}.casterType`] = "high";
    }

    updateData[`system.attributes.spells.spellbooks.${bookId}.-=spontaneous`] = null;
  }
}

/**
 * Migrate spellbook kind (arcane, divine, psychic, ...)
 *
 * @param {object} actorData - Actor data
 * @param {object} updateData - Update data
 * @param {Actor} actor - Actor document
 */
function _migrateActorSpellbookKind(actorData, updateData, actor) {
  for (const [bookId, book] of Object.entries(
    foundry.utils.getProperty(actorData.system, "attributes.spells.spellbooks") || {}
  )) {
    if (book.kind === undefined && book.inUse) {
      // Attempt to get data from class
      const castingClass =
        !!book.class && book.class !== "_hd" ? actor.itemTypes.class.find((i) => i.system.tag === book.class) : null;
      let kind = castingClass?.system.casting?.spells;

      if (!kind) {
        // Attempt to determine kind without access to source class
        kind = "arcane"; // Default to arcane if all else fails
        if (book.arcaneSpellFailure) kind = "arcane";
        else if (book.psychic) kind = "psychic";
        else if (book.spellPreparationMode === "prepared" && book.ability === "int") kind = "alchemy";
        else if (book.class !== "_hd") kind = "divine";
      }

      updateData[`system.attributes.spells.spellbooks.${bookId}.kind`] = kind;
    }
  }
}

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
      !(foundry.utils.getProperty(ent, "items") || []).filter((o) => o.type === "class").length
    )
      continue;
    if (foundry.utils.getProperty(ent, k) !== undefined) {
      const kList = k.split(".");
      kList[kList.length - 1] = `-=${kList[kList.length - 1]}`;
      updateData[kList.join(".")] = null;
    }
  }
};

const _migrateUnusedActorCreatureType = function (ent, updateData) {
  const type = foundry.utils.getProperty(ent.system, "attributes.creatureType");
  if (type != undefined) updateData["system.attributes.-=creatureType"] = null;
};

const _migrateActorSpellbookDCFormula = function (ent, updateData) {
  const spellbooks = Object.keys(foundry.utils.getProperty(ent.system, "attributes.spells.spellbooks") || {});

  for (const k of spellbooks) {
    const key = `system.attributes.spells.spellbooks.${k}.baseDCFormula`;
    const curFormula = foundry.utils.getProperty(ent, key);
    if (!curFormula) updateData[key] = "10 + @sl + @ablMod";
  }
};

const _migrateActorSpellbookName = function (ent, updateData) {
  const spellbooks = Object.entries(foundry.utils.getProperty(ent.system, "attributes.spells.spellbooks") || {});
  for (const [bookId, book] of spellbooks) {
    if (book.altName !== undefined) {
      const key = `system.attributes.spells.spellbooks.${bookId}`;
      updateData[`${key}.-=altName`] = null;
      if (book.altName.length) updateData[`${key}.name`] = book.altName;
    }
  }
};

const _migrateActorSpellbookCL = function (ent, updateData) {
  const spellbooks = Object.keys(foundry.utils.getProperty(ent.system, "attributes.spells.spellbooks") || {});

  for (const k of spellbooks) {
    const key = `system.attributes.spells.spellbooks.${k}.cl`;
    const curBase = parseInt(foundry.utils.getProperty(ent, key + ".base"));
    const curFormula = foundry.utils.getProperty(ent, key + ".formula");
    if (curBase > 0) {
      if (curFormula.length > 0) updateData[`${key}.formula`] = curFormula + " + " + curBase;
      else updateData[`${key}.formula`] = curFormula + curBase;
      updateData[`${key}.base`] = 0;
    }
  }
};

const _migrateActorConcentration = function (ent, updateData) {
  const spellbooks = Object.keys(foundry.utils.getProperty(ent.system, "attributes.spells.spellbooks") || {});
  for (const k of spellbooks) {
    // Delete unused .concentration from old actors
    const key = `system.attributes.spells.spellbooks.${k}`;
    const oldValue = foundry.utils.getProperty(ent, `${key}.concentration`);
    const isString = typeof oldValue === "string";
    if (Number.isFinite(oldValue) || isString) updateData[`${key}.-=concentration`] = null;
    if (isString) {
      // Assume erroneous bonus formula location and combine it with existing bonus formula.
      const formulaKey = `${key}.concentrationFormula`;
      const formula = [oldValue];
      formula.push(foundry.utils.getProperty(ent, formulaKey) || "");
      updateData[formulaKey] = formula.filter((f) => f !== 0 && f?.toString().trim().length).join(" + ");
    }
  }
};

const _migrateActorHPAbility = function (ent, updateData) {
  // Set HP ability
  if (foundry.utils.getProperty(ent.system, "attributes.hpAbility") === undefined) {
    updateData["system.attributes.hpAbility"] = "con";
  }

  // Set Fortitude save ability
  if (foundry.utils.getProperty(ent.system, "attributes.savingThrows.fort.ability") === undefined) {
    updateData["system.attributes.savingThrows.fort.ability"] = "con";
  }

  // Set Reflex save ability
  if (foundry.utils.getProperty(ent.system, "attributes.savingThrows.ref.ability") === undefined) {
    updateData["system.attributes.savingThrows.ref.ability"] = "dex";
  }

  // Set Will save ability
  if (foundry.utils.getProperty(ent.system, "attributes.savingThrows.will.ability") === undefined) {
    updateData["system.attributes.savingThrows.will.ability"] = "wis";
  }
};

const _migrateItemArrayTypes = function (ent, updateData) {
  const conditionals = ent.system.conditionals;
  if (conditionals != null && !(conditionals instanceof Array)) {
    updateData["system.conditionals"] = [];
  }

  const contextNotes = ent.system.contextNotes;
  if (contextNotes != null && !(contextNotes instanceof Array)) {
    if (contextNotes instanceof Object) updateData["system.contextNotes"] = Object.values(contextNotes);
    else updateData["system.contextNotes"] = [];
  }
};

const _migrateWeaponImprovised = function (ent, updateData) {
  if (ent.type !== "weapon") return;

  const value = foundry.utils.getProperty(ent.system, "weaponType");
  if (value === "improv") {
    updateData["system.weaponType"] = "misc";
    updateData["system.properties.imp"] = true;
  }
};

// Migrates the weird .shortDescription back to .description.value
// Added with PF1 v10
const _migrateItemSpellDescription = function (itemData, updateData) {
  if (itemData.type !== "spell") return;

  if (itemData.system.shortDescription) {
    updateData["system.-=shortDescription"] = null;

    // If description.value exists, it's the older oversized pre-rendered version that is unwanted
    updateData["system.description.value"] = itemData.system.shortDescription;
  }
};

const _migrateSpellDivineFocus = function (item, updateData) {
  if (item.type !== "spell") return;

  const df = foundry.utils.getProperty(item.system, "components.divineFocus");
  if (typeof df === "boolean") updateData["system.components.divineFocus"] = Number(df);
};

const _migrateClassDynamics = function (ent, updateData) {
  if (ent.type !== "class") return;

  const bab = ent.system.bab;
  if (typeof bab === "number") updateData["system.bab"] = "low";

  const stKeys = ["system.savingThrows.fort.value", "system.savingThrows.ref.value", "system.savingThrows.will.value"];
  for (const key of stKeys) {
    const value = foundry.utils.getProperty(ent, key);
    if (typeof value === "number") updateData[key] = "low";
  }
};

const _migrateClassType = function (ent, updateData) {
  if (ent.type !== "class") return;

  if (ent.system.classType !== undefined && ent.system.subType === undefined) {
    updateData["system.subType"] = "base";
  }
};

// Added with PF1 v10
function _migrateClassCasting(itemData, updateData) {
  const casting = itemData.system?.casting;
  if (!casting) return;

  if (!casting.type) {
    updateData["system.-=casting"] = null;
    return;
  }

  // domainSlots -> domain
  if (casting.domainSlots !== undefined) {
    updateData["system.casting.domain"] = casting.domain ?? casting.domainSlots ?? 1;
    updateData["system.casting.-=domainSlots"] = null;
  }
}

const _migrateWeaponCategories = function (ent, updateData) {
  if (ent.type !== "weapon") return;

  // Change category
  const type = ent.system.weaponType;
  if (type === "misc") {
    updateData["system.weaponType"] = "misc";
    updateData["system.weaponSubtype"] = "other";
  } else if (type === "splash") {
    updateData["system.weaponType"] = "misc";
    updateData["system.weaponSubtype"] = "splash";
  }

  const changeProp = ["simple", "martial", "exotic"].includes(type);
  if (changeProp && ent.system.weaponSubtype == null) {
    updateData["system.weaponSubtype"] = "1h";
  }

  // Change light property
  const lgt = foundry.utils.getProperty(ent.system, "properties.lgt");
  if (lgt != null) {
    updateData["system.properties.-=lgt"] = null;
    if (lgt === true && changeProp) {
      updateData["system.weaponSubtype"] = "light";
    }
  }

  // Change two-handed property
  const two = foundry.utils.getProperty(ent.system, "properties.two");
  if (two != null) {
    updateData["system.properties.-=two"] = null;
    if (two === true && changeProp) {
      updateData["system.weaponSubtype"] = "2h";
    }
  }

  // Change melee property
  const melee = foundry.utils.getProperty(ent.system, "weaponData.isMelee");
  if (melee != null) {
    updateData["system.weaponData.-=isMelee"] = null;
    if (melee === false && changeProp) {
      updateData["system.weaponSubtype"] = "ranged";
    }
  }
};

const _migrateArmorCategories = function (ent, updateData) {
  if (ent.type !== "equipment") return;

  const oldType = foundry.utils.getProperty(ent.system, "armor.type");
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

/**
 * Convert string armor max dex to number.
 *
 * Introduced with PF1 v10
 *
 * @param item
 * @param updateData
 */
const _migrateArmorMaxDex = (item, updateData) => {
  if (item.type !== "equipment") return;

  let maxDex = item.system.armor?.dex;
  // Skip valid states
  if (maxDex === undefined || maxDex === null) return;
  if (typeof maxDex === "number") return;

  // Convert string to number
  maxDex = parseInt(maxDex);
  if (Number.isInteger(maxDex)) {
    updateData["system.armor.dex"] = maxDex;
  }
  // Assume corrupt value otherwise
  else {
    updateData["system.armor.-=dex"] = null;
  }
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

const _migrateSpellDescriptors = (item, updateData) => {
  if (item.type !== "spell" || item.system.types === undefined) return;

  const current = item.system.types
    .split(",")
    .flatMap((x) => x.split(";"))
    .filter((x) => x)
    .map((x) => x.trim());

  const value = [];
  const custom = [];
  const entries = Object.entries(pf1.config.spellDescriptors);
  current.forEach((c) => {
    const exists = entries.find(([k, v]) => c.toLowerCase() === k.toLowerCase() || c.toLowerCase() === v.toLowerCase());
    if (exists) {
      value.push(exists[0]);
    } else {
      custom.push(c);
    }
  });

  updateData["system.-=types"] = null;
  updateData["system.descriptors.value"] = value;
  updateData["system.descriptors.custom"] = custom.join("; ");
};

const _migrateItemSize = function (ent, updateData) {
  // Convert custom sizing in weapons
  if (ent.type === "weapon") {
    const wdSize = foundry.utils.getProperty(ent.system, "weaponData.size");
    if (wdSize) {
      // Move old
      updateData["system.size"] = wdSize;
      updateData["system.weaponData.-=size"] = null;
      return;
    }
  }

  const oldSize = ent.system.size;
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

const _migrateItemFeatAbilityTypes = function (itemData, updateData) {
  if (itemData.type !== "feat") return;

  const type = itemData.system.abilityType;
  // Convert "none" and other invalid values (e.g. null or "n/a") to "na"
  // Added with PF1 v10
  if (pf1.config.abilityTypes[type] === undefined) {
    updateData["system.abilityType"] = "na";
  }
};

const _migrateClassLevels = function (ent, updateData) {
  const level = ent.system.levels;
  if (typeof level === "number" && ent.system.level == null) {
    updateData["system.level"] = level;
    updateData["system.-=levels"] = null;
  }
};

const _migrateSavingThrowTypes = function (ent, updateData) {
  if (
    foundry.utils.getProperty(ent.system, "save.type") == null &&
    typeof foundry.utils.getProperty(ent.system, "save.description") === "string"
  ) {
    const desc = foundry.utils.getProperty(ent.system, "save.description");
    if (desc.match(/REF/i)) updateData["system.save.type"] = "ref";
    else if (desc.match(/FORT/i)) updateData["system.save.type"] = "fort";
    else if (desc.match(/WILL/i)) updateData["system.save.type"] = "will";
  }
};

const _migrateCR = function (ent, updateData) {
  // Migrate CR offset
  const crOffset = ent.system.crOffset;
  if (typeof crOffset === "number") {
    updateData["system.crOffset"] = crOffset.toString();
  }
};

const _migrateItemChanges = function (itemData, updateData) {
  // Migrate changes
  const changes = itemData.system.changes;
  if (Array.isArray(changes)) {
    const newChanges = [];
    for (const c of changes) {
      if (Array.isArray(c)) {
        const newChange = new ItemChange({
          formula: c[0],
          target: c[1],
          subTarget: c[2],
          modifier: c[3],
        });

        newChanges.push(newChange.toObject());
      } else {
        const cd = foundry.utils.deepClone(c); // Avoid mutating source data so diff works properly
        // Transform legacy operators
        if (cd.operator === "=") cd.operator = "set";
        if (cd.operator === "+") cd.operator = "add";

        // Value should not exist, yet it was added previously by using derived data for updates.
        delete cd.value;

        newChanges.push(new ItemChange(cd).toObject());
      }
    }

    // Alter the changes list, but only if changes actually occurred. Bidirectional to detect deletions.
    if (
      !foundry.utils.isEmpty(foundry.utils.diffObject(changes, newChanges)) ||
      !foundry.utils.isEmpty(foundry.utils.diffObject(newChanges, changes))
    ) {
      updateData["system.changes"] = newChanges;
    }
  }

  const oldChanges = updateData["system.changes"] ?? itemData.system?.changes ?? [];
  const newChanges = [];
  let updateChanges = false;
  for (const change of oldChanges) {
    const newChange = { ...change };
    // Replace targets with .subSkills. for ones without
    // @since PF1 v10
    if (/\.subSkills\./.test(change.subTarget)) {
      newChange.subTarget = change.subTarget.replace(".subSkills.", ".");
      updateChanges = true;
    }
    // Remove use of penalty bonus type
    // @since PF1 v10
    if (change.modifier === "penalty") {
      // Convert the special ability score case to specific target
      if (["str", "dex", "con", "int", "wis", "cha"].includes(change.subTarget)) {
        newChange.subTarget = `${change.subTarget}Pen`;
      }
      // Convert all to untyped modifiers
      newChange.modifier = "untyped";
      updateChanges = true;
    }
    newChanges.push(newChange);
  }
  if (updateChanges) {
    updateData["system.changes"] = newChanges;
  }
};

const _migrateItemContextNotes = (itemData, updateData) => {
  // Migrate context notes
  const oldNotes = itemData.system.contextNotes;
  if (Array.isArray(oldNotes) && oldNotes?.length > 0) {
    const newNotes = [];

    for (const oldNote of oldNotes) {
      let newNote = foundry.utils.deepClone(oldNote);

      // Transform old tuple.
      if (Array.isArray(oldNote)) {
        newNote = { text: oldNote[0], target: oldNote[1], subTarget: oldNote[2] };
      }

      newNote = new pf1.components.ContextNote(newNote).toObject();

      newNotes.push(newNote);
    }

    // Alter the context note list, but only if changes actually occurred. Bidirectional to detect deletions.
    if (
      !foundry.utils.isEmpty(foundry.utils.diffObject(oldNotes, newNotes)) ||
      !foundry.utils.isEmpty(foundry.utils.diffObject(newNotes, oldNotes))
    ) {
      updateData["system.contextNotes"] = newNotes;
    }
  }

  const notes = updateData["system.contextNotes"] ?? oldNotes ?? [];
  let updateNotes = false;
  const newNotes = [];
  for (const note of notes) {
    const newNote = { ...note };
    // Replace targets with .subSkills. for ones without
    // @since PF1 v10
    if (/^skill\..+\.subSkills\..+$/.test(note.target)) {
      newNote.target = note.target.replace(".subSkills.", ".");
      updateNotes = true;
    }
    newNotes.push(newNote);
  }
  if (updateNotes) {
    updateData["system.contextNotes"] = newNotes;
  }
};

const _migrateItemChangeFlags = (item, updateData) => {
  const flags = item.system?.changeFlags;
  if (!flags) return;

  // Dwarf-like encumbrance to distinct no medium/heavy encumbrance
  if (flags.noEncumbrance !== undefined) {
    if (flags.noEncumbrance === true) {
      updateData["system.changeFlags.noMediumEncumbrance"] = true;
      updateData["system.changeFlags.noHeavyEncumbrance"] = true;
    }
    updateData["system.changeFlags.-=noEncumbrance"] = null;
  }
};

const _migrateEquipmentSize = function (ent, updateData) {
  if (ent.type !== "equipment") return;

  const size = ent.system.size;
  if (!size) {
    updateData["system.size"] = "med";
  }
};

// Migrate .weight number to .weight.value
// Migrate .baseWeight that was briefly introduced in 0.81
const _migrateItemWeight = function (ent, updateData) {
  const baseWeight = ent.system.baseWeight,
    weight = ent.system.weight;

  // Skip items of inappropriate type
  const isPhysical = CONFIG.Item.documentClasses[ent.type]?.isPhysical;
  if (!isPhysical) {
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

const _migrateSpellCosts = function (ent, updateData) {
  if (ent.type !== "spell") return;

  const spellPointCost = foundry.utils.getProperty(ent.system, "spellPoints.cost");
  if (spellPointCost == null) {
    updateData["system.spellPoints.cost"] = "1 + @sl";
  }

  const slotCost = ent.system.slotCost;
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

/**
 * Migrate spell preparation
 *
 * Added with PF1 v10
 *
 * @param {object} itemData
 * @param {object} updateData
 * @param {object} context
 * @param {Item} [context.item=null]
 */
function _migrateSpellPreparation(itemData, updateData, { item = null } = {}) {
  if (itemData.type !== "spell") return;

  const spellbook = item?.spellbook;
  const prepMode = spellbook?.spellPreparationMode || "prepared";
  const usesSpellPoints = spellbook?.spellPoints?.useSystem ?? false;
  const isPrepared = usesSpellPoints ? false : prepMode === "prepared";

  const prep = itemData.system.preparation ?? {};
  if (prep.maxAmount !== undefined) {
    if (!(prep.max > 0)) {
      // Migrate even older non number max amount
      if (typeof prep.maxAmount !== "number") prep.maxAmount = 0;
      updateData["system.preparation.max"] = prep.maxAmount ?? 0;
    }
    updateData["system.preparation.-=maxAmount"] = null;
  }
  if (prep.spontaneousPrepared !== undefined) {
    if (!(prep.value > 0) && !isPrepared) {
      updateData["system.preparation.value"] = prep.spontaneousPrepared ? 1 : 0;
    }
    updateData["system.preparation.-=spontaneousPrepared"] = null;
  }
  if (prep.preparedAmount !== undefined) {
    if (!(prep.value > 0) && isPrepared) {
      updateData["system.preparation.value"] = Math.max(
        prep.preparedAmount,
        updateData["system.preparation.value"] || 0
      );
    }
    updateData["system.preparation.-=preparedAmount"] = null;
  }
}

const _migrateLootEquip = function (ent, updateData) {
  if (ent.type === "loot" && !ent.system.equipped) {
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

const _migrateItemLinks = function (itemData, updateData, { item, actor }) {
  const linkData = itemData.system.links ?? {};
  for (const [linkType, oldLinks] of Object.entries(linkData)) {
    let updated = false;
    const links = foundry.utils.deepClone(oldLinks);
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

      // Convert ID to relative UUID
      if (link.id !== undefined && actor) {
        link.uuid = actor?.items?.get(link.id)?.getRelativeUUID(actor);
        delete link.id;
        updated = true;
      }

      if (actor && link.uuid) {
        let linked = fromUuidSync(link.uuid, { relative: actor });
        // Attempt to recover bad links to other actors
        if (linked?.actor) {
          // Attempt to adjust owned item
          if (linked.actor !== actor) linked = actor.items.get(linked.id);
          const newLink = linked?.getRelativeUUID(actor);
          // Successful recovery?
          if (linked && newLink !== link.uuid) {
            link.uuid = newLink;
            updated = true;
          }
        }
      }

      // Handle moved compendium content
      if (link.uuid) {
        const muuid = moved[link.uuid];
        if (muuid) {
          link.uuid = muuid;
          updated = true;
        }
      }

      // Remove unused data
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

const _migrateItemProficiencies = function (item, updateData) {
  // Added with PF1 v10
  // Migrate sim/mar to simple/martial
  const wprofmap = {
    sim: "simple",
    mar: "martial",
  };

  const oldKeys = Object.keys(wprofmap);
  if (item.system.weaponProf?.value?.some((p) => oldKeys.includes(p))) {
    const nwprof = item.system.weaponProf.value.map((p) => wprofmap[p] || p);
    updateData["system.weaponProf.value"] = nwprof;
  }
};

const _migrateItemNotes = function (ent, updateData) {
  const list = ["system.attackNotes", "system.effectNotes"];
  for (const k of list) {
    const value = foundry.utils.getProperty(ent, k);
    const hasValue = foundry.utils.hasProperty(ent, k);
    if (hasValue && !(value instanceof Array)) {
      updateData[k] = [];
      if (typeof value === "string" && value.length > 0) {
        updateData[k] = value.trim().split(/[\n\r]/);
      }
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
      if (item.system[k] != null) actionData[k] = foundry.utils.deepClone(item.system[k]);
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

const _migrateScriptCalls = (item, updateData) => {
  if (!(item.system.scriptCalls?.length > 0)) return;
  let updated = false;

  // Clear out unused name and image for linked macros.
  const scripts = foundry.utils.deepClone(item.system.scriptCalls);
  for (const script of scripts) {
    if (script.type == "macro") {
      if (script.name || script.img) {
        script.name = "";
        script.img = "";
        updated = true;
      }
    }
  }

  if (updated) {
    updateData["system.scriptCalls"] = scripts;
  }
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
        // Skip invalid entries
        if (typeof classId !== "string" || classId.length == 0) return learned;
        // Split combined entries and transform them to object format
        for (let clsId of classId.split("/")) {
          clsId = clsId.trim().replace(".", "-"); // Sanitize
          if (clsId) learned[clsId] = level;
        }
        return learned;
      }, {});
    }
  }
};

/**
 * @param {object} action - Action data
 * @param {object} itemData - Parent item data
 */
const _migrateActionChargeUsage = function (action, itemData) {
  if (action.uses?.autoDeductCharges !== undefined) {
    if (action.uses.autoDeductCharges === false) {
      action.uses.autoDeductChargesCost = "0";
    } else if (action.uses.autoDeductChargesCost === "1") action.uses.autoDeductChargesCost = "";
    delete action.uses.autoDeductCharges;
  }
};

/**
 * Migrate action..
 * - ... usesAmmo boolean away
 * - ... ammoType to item.system.ammo.type
 *
 * @param {object} action - Action data
 * @param {object} itemData - Parent item data
 * @param {object} updateData - Item update data
 */
const _migrateActionAmmunitionUsage = function (action, itemData, updateData) {
  if (action.usesAmmo === false) {
    delete action.ammoType;
  }
  if (action.usesAmmo === true) {
    if (!itemData.system.ammo?.type && !updateData["system.ammo.type"]) {
      updateData["system.ammo.type"] = action.ammoType;
      action.ammoType = ""; // Inherit from item
    }

    // Same as base item
    if (itemData.system.ammo?.type == action.ammoType) delete action.ammoType;
  }

  // Migrate .ammoType to .ammo.type
  if (action.ammoType) {
    action.ammo ??= {};
    action.ammo.type = action.ammoType;
  }
  delete action.ammoType;

  // Delete empty ammo type (inherited)
  if (action.ammo && !action.ammo.type) {
    delete action.ammo.type;
  }

  // Uses ammo is no longer used
  delete action.usesAmmo;
};

// Migrate harmless from save descriptor to the harmless toggle.
// Added with PF1 v10
const _migrateActionHarmlessSpell = (action, itemData) => {
  if (!action.save.description) return;

  if (/\bharmless\b/.test(action.save.description)) {
    action.save.description = action.save.description
      .replace(/\s*\bharmless\b\s*/, "")
      .replace(/\(,\s*/, "(")
      .replace(/\s*,\)/, ")")
      .replace("()", "")
      .trim();
    action.save.harmless = true;
  }
};

// Migrate .spellArea to .area
// Added with PF1 v10
const _migrateActionSpellArea = (action, itemData) => {
  action.area ||= action.spellArea;
  delete action.spellArea;
};

/**
 * @since PF1 v10
 * @param action
 * @param itemData
 */
const _migrateActionTemplate = (action, itemData) => {
  //
  const mt = action.measureTemplate;
  if (!mt) return;

  mt.color ||= mt.customColor;
  delete mt.overrideColor;
  delete mt.customColor;

  mt.texture ||= mt.customTexture;
  delete mt.overrideTexture;
  delete mt.customTexture;
};

// Action duration
// Added with PF1 v10
const _migrateActionDuration = (action, itemData) => {
  action.duration ??= {};

  // Something has caused "null" string durations for some people, this clears it.
  if (action.duration.value === "null") action.duration.value = "";

  // Swap units to "special" if undefined and formula exists
  if (!action.duration.units && !!action.duration.value) {
    action.duration.units = "spec";
  }

  // Swap "instantaneous" formula to instantaneous unit
  if (action.duration.value === "instantaneous") {
    delete action.duration.value;
    action.duration.units = "inst";
  }

  // Convert easy special values to actual duration info
  if (action.duration.units === "spec") {
    const value = action.duration.value || "";

    switch (value) {
      case "1 round":
      case "1 full round":
        action.duration.value = "1";
        action.duration.units = "round";
        break;
      case "1 min.":
      case "1 minute":
        action.duration.value = "1";
        action.duration.units = "minute";
        break;
      case "1 hour":
        action.duration.value = "1";
        action.duration.units = "hour";
        break;
      case "8 hours":
        action.duration.value = "8";
        action.duration.units = "hour";
        break;
      case "24 hours":
        action.duration.value = "24";
        action.duration.units = "hour";
        break;
      case "1 day":
        action.duration.value = "1";
        action.duration.units = "day";
        break;
      case "permanent":
        delete action.duration.value;
        action.duration.units = "perm";
        break;
      case "see below":
      case "see text":
        delete action.duration.value;
        action.duration.units = "seeText";
        break;
    }
  }
};

/**
 * Added with PF1 v10
 *
 * @param {object} action
 * @param {object} itemData
 */
const _migrateActionExtraAttacks = (action, itemData) => {
  // Convert tuples into objects
  if (action.attackParts?.length) {
    const parts = action.attackParts ?? [];
    if (parts.some((p) => Array.isArray(p))) {
      action.attackParts = parts.map((part) => (Array.isArray(part) ? { formula: part[0], name: part[1] } : part));
    }

    // Ensure formulas are strings
    for (const part of action.attackParts) part.formula = `${part.formula}`;
  }

  // Unify extra attacks structure
  action.extraAttacks ??= {};

  if (action.attackParts !== undefined) {
    action.extraAttacks.manual = action.attackParts ?? [];
    delete action.attackParts;
  }

  if (action.formulaicAttacks !== undefined) {
    action.extraAttacks.formula ??= {};
    action.extraAttacks.formula.count = action.formulaicAttacks?.count?.formula || "";
    action.extraAttacks.formula.bonus = action.formulaicAttacks?.bonus?.formula || "";
    action.extraAttacks.formula.label = action.formulaicAttacks?.label || "";
    delete action.formulaicAttacks;
  }

  if (!action.extraAttacks.type) {
    // Convert existing formulas to standard options
    if (
      action.extraAttacks.formula?.count === "min(3, ceil(@attributes.bab.total / 5) - 1)" &&
      action.extraAttacks.formula?.bonus === "@formulaicAttack * -5"
    ) {
      action.extraAttacks.type = "standard";
      delete action.extraAttacks.formula.count;
      delete action.extraAttacks.formula.bonus;
      delete action.extraAttacks.formula.label;

      if (action.extraAttacks.manual?.length) {
        action.extraAttacks.type = "advanced";
      } else {
        delete action.extraAttacks.manual;
      }
    } else {
      if (action.extraAttacks.formula?.count?.length || action.extraAttacks.manual?.length) {
        action.extraAttacks.type = "custom";
      }
    }

    // Delete unused data
    if (!action.extraAttacks.formula?.count) delete action.extraAttacks.formula.count;
    if (!action.extraAttacks.formula?.bonus) delete action.extraAttacks.formula.bonus;
    if (!action.extraAttacks.formula?.label) delete action.extraAttacks.formula.label;
    if (!(action.extraAttacks.manual?.length > 0)) delete action.extraAttacks.manual;
  }

  if (foundry.utils.isEmpty(action.extraAttacks.formula)) {
    delete action.extraAttacks.formula;
  }
};

/**
 * Migrate value types that should never have been those types.
 *
 * This may be only correcting macro/module errors and not things caused by the system.
 * Previously these were type checked in code with special handling.
 *
 * @param action
 * @param itemData
 */
const _migrateActionObsoleteTypes = (action, itemData) => {
  const templateSize = action.measureTemplate?.size;
  if (templateSize !== undefined) {
    if (typeof templateSize !== "string") {
      action.measureTemplate.size = `${templateSize}`;
    }
  }
  const durVal = action.duration?.value;
  if (durVal !== undefined && durVal !== null) {
    if (typeof durVal !== "string") {
      action.duration.value = `${durVal}`;
    }
  }
};

/**
 * Remove dead data
 *
 * @param action
 * @param itemData
 */
const _migrateActionUnusedData = (action, itemData) => {
  // Added with PF1 v10
  if (!action.formula) delete action.formula;
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
      defaultAction?.uses?.autoDeductCharges === true &&
      updateData["system.uses.autoDeductChargesCost"] === undefined
    ) {
      updateData["system.uses.autoDeductChargesCost"] = "0";
    }
  }
};

// Added with PF1 v10
const _migrateItemLimitedUses = (itemData, updateData) => {
  // Migrate unlimited to empty selection, as the two are identical in meaning
  if (itemData.system.uses?.per === "unlimited") {
    updateData["system.uses.per"] = "";
  }

  // Only physical items have single use, convert use cases to 1 charge
  const isPhysical = CONFIG.Item.documentClasses[itemData.type]?.isPhysical;
  if (!isPhysical) {
    if (itemData.system.uses?.per === "single") {
      updateData["system.uses.per"] = "charges";
      updateData["system.uses.maxFormula"] = "1";
    }
  }
};

/**
 * Migrate damage part tuples into objects
 *
 * Introduced with PF1 v9
 *
 * @param {object} action - Action data
 * @param {object} itemData - Parent item data
 */
const _migrateActionDamageParts = function (action, itemData) {
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

/**
 * @param {object} action - Action data
 * @param {object} itemData - Parent item data
 */
const _migrateActionDamageType = function (action, itemData) {
  // Determine data paths using damage types
  const damageGroupPaths = ["damage.parts", "damage.critParts", "damage.nonCritParts"];
  for (const damageGroupPath of damageGroupPaths) {
    const damageGroup = foundry.utils.getProperty(action, damageGroupPath);
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

/**
 * @param {object} action - Action data
 * @param {object} itemData - Parent item data
 */
const _migrateActionConditionals = function (action, itemData) {
  for (const conditional of action.conditionals ?? []) {
    // Create conditional ID
    if (!conditional._id) conditional._id = foundry.utils.randomID(16);

    if (!Array.isArray(conditional.modifiers)) {
      conditional.modifiers = Object.values(conditional.modifiers);
    }

    for (const modifier of conditional.modifiers) {
      // Create modifier ID
      if (!modifier._id) modifier._id = foundry.utils.randomID(16);

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

/**
 * @param {object} action - Action data
 * @param {object} itemData - Parent item data
 */
const _migrateActionEnhOverride = function (action, itemData) {
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

/**
 * @param {object} action - Action data
 * @param {object} itemData - Parent item data
 */
const _migrateActionPrimaryAttack = function (action, itemData) {
  if (action.naturalAttack?.primaryAttack === undefined) {
    foundry.utils.setProperty(action, "naturalAttack.primaryAttack", itemData.system.primaryAttack ?? true);
  }
};

const _migrateActorCR = function (ent, updateData) {
  // Migrate base CR
  const cr = foundry.utils.getProperty(ent.system, "details.cr");
  if (typeof cr === "number") {
    updateData["system.details.cr.base"] = cr;
  } else if (cr == null) {
    updateData["system.details.cr.base"] = 1;
  }

  // Remove derived data if present
  if (foundry.utils.getProperty(ent.system, "details.cr.total") !== undefined) {
    updateData["system.details.cr.-=total"] = null;
  }
};

const _migrateAttackAbility = function (ent, updateData) {
  const cmbAbl = foundry.utils.getProperty(ent.system, "attributes.cmbAbility");
  if (cmbAbl === undefined) updateData["system.attributes.cmbAbility"] = "str";

  const meleeAbl = foundry.utils.getProperty(ent.system, "attributes.attack.meleeAbility");
  if (meleeAbl === undefined) updateData["system.attributes.attack.meleeAbility"] = "str";

  const rangedAbl = foundry.utils.getProperty(ent.system, "attributes.attack.rangedAbility");
  if (rangedAbl === undefined) updateData["system.attributes.attack.rangedAbility"] = "dex";
};

const _migrateActorSpellbookUsage = function (ent, updateData) {
  const spellbookUsage = foundry.utils.getProperty(ent.system, "attributes.spells.usedSpellbooks");
  if (spellbookUsage !== undefined) {
    updateData["system.attributes.spells.-=usedSpellbooks"] = null;
  }
};

const _migrateActorNullValues = function (ent, updateData) {
  // Prepare test data
  const entries = { "system.attributes.energyDrain": foundry.utils.getProperty(ent.system, "attributes.energyDrain") };
  for (const [k, a] of Object.entries(ent.system.abilities || {})) {
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
  const spellbooks = foundry.utils.getProperty(ent.system, "attributes.spells.spellbooks") || {};

  for (const [k, b] of Object.entries(spellbooks)) {
    if (b.domainSlotValue !== undefined) continue;
    const key = `system.attributes.spells.spellbooks.${k}.domainSlotValue`;
    updateData[key] = 1;
  }
};

const _migrateActorStatures = function (ent, updateData) {
  const stature = foundry.utils.getProperty(ent.system, "traits.stature");

  if (stature === undefined) {
    updateData["system.traits.stature"] = "tall";
  }
};

// Migrate weapon proficiencies
// Converts sim and mar to simple and martial
// Added with PF1 v10
const _migrateActorProficiencies = (actorData, updateData, { actor = null } = {}) => {
  const wprofs = actorData.system.traits?.weaponProf?.value;
  if (wprofs === undefined) return;

  if (!Array.isArray(wprofs) || wprofs.length == 0) return; // TODO: Migrate if in wrong format

  const wprofmap = {
    sim: "simple",
    mar: "martial",
  };

  const oldKeys = Object.keys(wprofmap);
  if (wprofs.some((p) => oldKeys.includes(p))) {
    const nwprofs = wprofs.map((v) => wprofmap[v] || v);
    updateData["system.traits.weaponProf.value"] = nwprofs;
  }
};

const _migrateActorDefenseAbility = function (ent, updateData) {
  const normalACAbl = foundry.utils.getProperty(ent.system, "attributes.ac.normal.ability");
  if (normalACAbl === undefined) updateData["system.attributes.ac.normal.ability"] = "dex";
  const touchACAbl = foundry.utils.getProperty(ent.system, "attributes.ac.touch.ability");
  if (touchACAbl === undefined) updateData["system.attributes.ac.touch.ability"] = "dex";

  // CMD
  const cmdDexAbl = foundry.utils.getProperty(ent.system, "attributes.cmd.dexAbility");
  if (cmdDexAbl === undefined) updateData["system.attributes.cmd.dexAbility"] = "dex";
  const cmdStrAbl = foundry.utils.getProperty(ent.system, "attributes.cmd.strAbility");
  if (cmdStrAbl === undefined) updateData["system.attributes.cmd.strAbility"] = "str";
};

const _migrateActorInitAbility = function (ent, updateData) {
  const abl = foundry.utils.getProperty(ent.system, "attributes.init.ability");

  if (abl === undefined) {
    updateData["system.attributes.init.ability"] = "dex";
  }
};

const _migrateActorCMBRevamp = function (ent, updateData) {
  if (foundry.utils.getProperty(ent.system, "attributes.cmb.total") !== undefined) {
    updateData["system.attributes.cmb.-=total"] = null;
  }
};

const _migrateActorChangeRevamp = function (ent, updateData) {
  // Skills
  Object.keys(ent.system.skills ?? {}).forEach((s) => {
    const path = `system.skills.${s}.`;
    if (foundry.utils.getProperty(ent, path + "changeBonus") !== undefined) {
      updateData[path + "-=changeBonus"] = null;
    }

    // Check for subskill
    Object.keys(foundry.utils.getProperty(ent, `system.skills.${s}.subSkills`) ?? {}).forEach((s2) => {
      const subPath = `system.skills.${s}.subSkills.${s2}.`;
      if (foundry.utils.getProperty(ent, subPath + "changeBonus") !== undefined) {
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
    if (foundry.utils.getProperty(ent, key) !== undefined) {
      updateData["system." + updateKey] = null;
    }
  });
};

const _migrateActorInvaliddSkills = (actor, updateData) => {
  const skills = actor.system.skills;
  if (!skills) return;
  for (const [key, sklData] of Object.entries(skills)) {
    if (!sklData) {
      updateData[`system.skills.-=${key}`] = null;
      continue;
    }
    for (const [subKey, subSklData] of Object.entries(sklData.subSkills ?? {})) {
      if (!subSklData) {
        updateData[`system.skills.${key}.subSkills.-=${subKey}`] = null;
      }
    }
  }
};

/**
 * Migrate abnormal skill rank values to 0.
 * Primarily changing nulls to 0 to match new actors.
 *
 * @param ent
 * @param updateData
 */
const _migrateActorSkillRanks = function (ent, updateData) {
  const skills = ent.system.skills;
  if (!skills) return; // Unlinked with no skill overrides of any kind
  for (const [key, sklData] of Object.entries(skills)) {
    if (!sklData) continue;
    if (!Number.isFinite(sklData.rank)) updateData[`system.skills.${key}.rank`] = 0;
    for (const [subKey, subSklData] of Object.entries(sklData.subSkills ?? {})) {
      if (!subSklData) continue;
      if (!Number.isFinite(subSklData.rank)) updateData[`system.skills.${key}.subSkills.${subKey}.rank`] = 0;
    }
  }
};

const _migrateCarryBonus = function (ent, updateData) {
  if (foundry.utils.getProperty(ent.system, "details.carryCapacity.bonus.user") === undefined) {
    let bonus = foundry.utils.getProperty(ent.system, "abilities.str.carryBonus");
    if (bonus !== undefined) {
      bonus = bonus || 0;
      updateData["system.details.carryCapacity.bonus.user"] = bonus;
    }
    updateData["system.abilities.str.-=carryBonus"] = null;
  }
  if (foundry.utils.getProperty(ent.system, "details.carryCapacity.multiplier.user") === undefined) {
    let mult = foundry.utils.getProperty(ent.system, "abilities.str.carryMultiplier");
    if (mult !== undefined) {
      mult = mult || 1;
      updateData["system.details.carryCapacity.multiplier.user"] = mult - 1;
    }
    updateData["system.abilities.str.-=carryMultiplier"] = null;
  }
};

const _migrateBuggedValues = function (ent, updateData) {
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
    const oldValue = foundry.utils.getProperty(ent, key),
      value = parseInt(oldValue ?? 0);
    if (oldValue !== value) {
      updateData[key] = value;
    }
  }
};

const _migrateSpellbookUsage = function (ent, updateData) {
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
    if (foundry.utils.getProperty(ent, path) !== true) {
      updateData[path] = true;
    }
  }
};

const _migrateActorHP = function (ent, updateData) {
  // Migrate HP, Wounds and Vigor values from absolutes to relatives, which is a change in 0.80.16
  for (const k of ["system.attributes.hp", "system.attributes.wounds", "system.attributes.vigor"]) {
    const value = foundry.utils.getProperty(ent, `${k}.value`);

    // Fill offset if missing
    if (foundry.utils.getProperty(ent, `${k}.offset`) == null) {
      const max = foundry.utils.getProperty(ent, `${k}.max`) ?? 0;
      updateData[`${k}.offset`] = (value ?? 0) - max;
    }
    // Value is no longer used if it exists

    if (value !== undefined) {
      updateData[`${k}.-=value`] = null;
    }
  }
};

const _migrateActorSenses = function (ent, updateData, token) {
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
      tr: 0,
      si: false,
      sc: 0,
      custom: oldSenses,
    };
  }

  // Migrate boolean Scent sense to number
  if (typeof oldSenses?.sc === "boolean") {
    updateData["system.traits.senses.sc"] = oldSenses.sc ? 30 : 0;
  }

  // Migrate boolean true seeing to number
  if (typeof oldSenses?.tr === "boolean") {
    updateData["system.traits.senses.tr"] = oldSenses.tr ? 120 : 0;
  }
};

const _migrateActorSkillJournals = function (ent, updateData) {
  const reOldJournalFormat = /^[a-zA-Z0-9]+$/;
  for (const [skillKey, sklData] of Object.entries(ent.system.skills ?? {})) {
    if (!sklData) continue;
    for (const [subSkillKey, subSklData] of Object.entries(sklData.subSkills ?? {})) {
      if (!subSklData) continue;
      if (subSklData.journal?.match(reOldJournalFormat)) {
        updateData[`system.skills.${skillKey}.subSkills.${subSkillKey}.journal`] = `JournalEntry.${subSklData.journal}`;
      }
    }

    if (sklData.journal?.match(reOldJournalFormat)) {
      updateData[`system.skills.${skillKey}.journal`] = `JournalEntry.${sklData.journal}`;
    }
  }
};

const _migrateActorSubskillData = (actor, updateData) => {
  for (const [skillId, skillData] of Object.entries(actor.system.skills ?? {})) {
    if (!skillData) continue;
    for (const [subSkillId, subSkillData] of Object.entries(skillData.subSkills ?? {})) {
      if (!subSkillData) continue;
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

const _migrateActorTraitsCustomToArray = (actor, updateData) => {
  const keys = ["di", "dv", "ci", "languages", "armorProf", "weaponProf"];

  keys.forEach((key) => {
    const trait = actor.system.traits?.[key];
    if (!trait || typeof trait.custom !== "string") return;

    const custom =
      trait.custom
        ?.split(pf1.config.re.traitSeparator)
        .map((x) => x.trim())
        .filter((x) => x) ?? [];
    if (custom.length) {
      updateData[`system.traits.${key}.custom`] = custom;
    } else {
      updateData[`system.traits.${key}.-=custom`] = null;
    }
  });
};

/**
 * @param actorData
 * @param updateData
 * @since PF1 v10
 */
const _migrateActorFlags = (actorData, updateData) => {
  const flags = actorData.flags?.pf1;
  if (!flags) return;

  // visionPermission to visionSharing
  if (flags.visionPermission) {
    updateData["flags.pf1.visionSharing.default"] = flags.visionPermission.default === "yes" ? true : false;
    const mapping = {
      yes: true,
      no: false,
      default: null,
    };
    updateData["flags.pf1.visionSharing.users"] = Object.fromEntries(
      Object.entries(flags.visionPermission?.users ?? {}).map(([uid, data]) => [uid, mapping[data.level] ?? null])
    );
    updateData["flags.pf1.-=visionPermission"] = null;
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

const _migrateContainerReduction = (item, updateData) => {
  if (item.type !== "container") return;
  if (item.system.weightReduction !== undefined) {
    updateData["system.weight.reduction.percent"] = item.system.weightReduction;
    updateData["system.-=weightReduction"] = null;
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
 * @param item
 * @param updateData
 */
const _migrateItemTraitsCustomToArray = (item, updateData) => {
  const keys = ["armorProf", "descriptors", "languages", "weaponGroups", "weaponProf"];

  keys.forEach((key) => {
    const trait = item.system[key];
    if (!trait || typeof trait.custom !== "string") return;

    const custom = trait.custom
      .split(pf1.config.re.traitSeparator)
      .map((x) => x.trim())
      .filter((x) => x);

    if (custom.length) {
      updateData[`system.${key}.custom`] = custom;
    } else {
      updateData[`system.${key}.-=custom`] = null;
    }
  });
};

/**
 * @param {object} itemData
 * @param {object} updateData
 * @since PF1 v10
 */
const _migrateItemFlags = (itemData, updateData) => {
  if (!itemData.flags?.pf1) return;

  if (itemData.flags.pf1.abundant !== undefined) {
    updateData["system.abundant"] = Boolean(itemData.flags.pf1.abundant);
    updateData["flags.pf1.-=abundant"] = null;
  }
};

const _migrateItemMaterials = (itemData, updateData) => {
  // Convert incorrect material addon data
  if (itemData.system.material?.addon) {
    const addon = itemData.system.material.addon;
    if (!Array.isArray(addon)) {
      updateData["system.material.addon"] = Object.entries(addon)
        .filter(([_, chosen]) => chosen)
        .map(([key]) => key);
    }
  }
  if (itemData.system.armor?.material?.addon) {
    const addon = itemData.system.armor?.material?.addon;
    if (!Array.isArray(addon)) {
      updateData["system.material.addon"] = Object.entries(addon)
        .filter(([_, chosen]) => chosen)
        .map(([key]) => key);
    }
  }
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

  // useCustomTag not used since PF1 v10
  if (item.system.useCustomTag !== undefined) {
    updateData["system.-=useCustomTag"] = null;
    if (item.system.useCustomTag === false && item.system.tag !== undefined) {
      updateData["system.-=tag"] = null;
    }
  }

  // ammoType seems to have never been actually used, but it was stored in items
  if (item.system.ammoType !== undefined) {
    updateData["system.-=ammoType"] = null;
    // Move it anyway just in case, if missing
    if (!item.system.ammo?.type && item.system.ammoType) {
      updateData["system.ammo.type"] = item.system.ammoType;
    }
  }
};

/**
 * Migrate Active Effect data.
 * - Removes pf1_ status ID prefixes.
 *
 * Added with PF1 v10
 *
 * @param {object} actorData - Actor data
 * @param {object} updateData - Update data
 * @param {Actor} [actor] - Actor document
 * @param actor
 */
const _migrateActorActiveEffects = async (actorData, updateData, actor) => {
  // Migate Active Effects
  const effects = [];
  for (const ae of actorData.effects ?? []) {
    const aeUpdate = await migrateActiveEffectData(ae, actor);
    if (!foundry.utils.isEmpty(aeUpdate)) {
      aeUpdate._id = ae._id;
      effects.push(aeUpdate);
    }
  }

  if (effects.length) updateData.effects = effects;
};

const _migrateActorUnusedData = (actor, updateData) => {
  // Obsolete vision
  if (foundry.utils.getProperty(actor.system, "attributes.vision") !== undefined) {
    updateData["system.attributes.-=vision"] = null;
  }

  if (foundry.utils.getProperty(actor.prototypeToken, "flags.pf1.lowLightVision") !== undefined) {
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

  // Conditions no longer are permanently stored in actor data (since PF1 v10)
  if (actor.system.attributes?.conditions !== undefined) {
    updateData["system.attributes.-=conditions"] = null;
  }

  if (actor.system.details.level !== undefined) {
    updateData["system.details.-=level"] = null;
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

/**
 * Migrate Active Effect data
 *
 * @param {object} ae Active Effect data
 * @param {Actor} actor Actor
 */
const migrateActiveEffectData = async (ae, actor) => {
  if (!actor) return;

  const updateData = {};

  // Fix broken AE
  if (!ae.name) updateData.name = "No Name";

  /**
   * @param {string} origin Origin string
   * @returns {string|undefined} Relative UUID, if origin was found
   */
  const getNewRelativeOrigin = async (origin) => {
    if (typeof origin !== "string") return; // Invalid origin type, recorded by SBC?
    const newOrigin = await fromUuid(origin, { relative: actor });
    if (newOrigin instanceof Item && newOrigin.actor === actor) {
      return newOrigin.getRelativeUUID(actor);
    }
  };

  // Convert no longer used flags.pf1.prigin to origin, if no origin is present
  const originFlag = ae.flags?.pf1?.origin;
  if (originFlag) {
    if (!ae.origin) {
      const newOrigin = await getNewRelativeOrigin(originFlag);
      if (newOrigin) updateData.origin = newOrigin;
    }
    updateData.flags ??= {};
    updateData.flags.pf1 ??= {};
    updateData.flags.pf1["-=origin"] = null;
  }

  // Convert origin to relative origin
  if (ae.origin) {
    const newOrigin = await getNewRelativeOrigin(ae.origin);
    // Avoid empty updates
    if (newOrigin && ae.origin !== newOrigin) {
      updateData.origin = newOrigin;
    }
  }

  // Remove pf1_ prefix from status effects
  if (ae.statuses.some((s) => s.startsWith("pf1_"))) {
    updateData.statuses = Array.from(new Set(ae.statuses.map((s) => s.replace(/^pf1_/, ""))));
  }

  return updateData;
};
