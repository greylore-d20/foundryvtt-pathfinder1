/* eslint-disable no-case-declarations */
/**
 * The Pathfinder 1st edition game system for Foundry Virtual Tabletop
 * Author: Furyspark
 * Software License: GNU GPLv3
 */

// Import Modules
import { PF1, CONFIG_OVERRIDES } from "./module/config.js";
import {
  registerSystemSettings,
  registerClientSettings,
  migrateSystemSettings,
  getSkipActionPrompt,
} from "./module/settings.js";
import { preloadHandlebarsTemplates } from "./module/handlebars/templates.js";
import { registerHandlebarsHelpers } from "./module/handlebars/helpers.js";
import { tinyMCEInit } from "./module/mce/mce.js";
import { measureDistances, getConditions } from "./module/canvas.js";
import { TemplateLayerPF } from "./module/measure.js";
import { MeasuredTemplatePF } from "./module/measure.js";
import { SightLayerPF } from "./module/low-light-vision.js";
import { ActorBasePF } from "./module/actor/base.js";
import { ActorPF } from "./module/actor/entity.js";
import { ActorCharacterPF } from "./module/actor/types/character.js";
import { ActorNPCPF } from "./module/actor/types/npc.js";
import { BasicActorPF } from "./module/actor/types/basic.js";
import { ActorSheetPF } from "./module/actor/sheets/base.js";
import { ActorSheetPFCharacter } from "./module/actor/sheets/character.js";
import { ActorSheetPFNPC } from "./module/actor/sheets/npc.js";
import { ActorSheetPFNPCLite } from "./module/actor/sheets/npc-lite.js";
import { ActorSheetPFNPCLoot } from "./module/actor/sheets/npc-loot.js";
import { ActorSheetPFBasic } from "./module/actor/sheets/basic.js";
import { ActorSheetFlags } from "./module/apps/actor-flags.js";
import { ActorRestDialog } from "./module/apps/actor-rest.js";
import { SensesSelector } from "./module/apps/senses-selector.js";
import { SkillEditor } from "./module/apps/skill-editor.js";
import { AmbientLightPF } from "./module/low-light-vision.js";
import { CombatPF } from "./module/combat.js";
import { TokenPF } from "./module/token/token.js";
import { TokenDocumentPF } from "./module/token/document.js";
import { EntrySelector } from "./module/apps/entry-selector.js";
import { LevelUpForm } from "./module/apps/level-up.js";
import { PointBuyCalculator } from "./module/apps/point-buy-calculator.js";
import { ScriptEditor } from "./module/apps/script-editor.js";
import { SidebarPF } from "./module/apps/sidebar.js";
import { ActorTraitSelector } from "./module/apps/trait-selector.js";
import { ExperienceDistributor } from "./module/apps/xp-distributor.js";
import { DamageTypeSelector } from "./module/apps/damage-type-selector.js";
import { ActiveEffectPF } from "./module/ae/entity.js";
import { ItemPF } from "./module/item/entity.js";
import { ItemAttackPF } from "./module/item/types/attack.js";
import { ItemBuffPF } from "./module/item/types/buff.js";
import { ItemClassPF } from "./module/item/types/class.js";
import { ItemConsumablePF } from "./module/item/types/consumable.js";
import { ItemContainerPF } from "./module/item/types/container.js";
import { ItemEquipmentPF } from "./module/item/types/equipment.js";
import { ItemFeatPF } from "./module/item/types/feat.js";
import { ItemLootPF } from "./module/item/types/loot.js";
import { ItemRacePF } from "./module/item/types/race.js";
import { ItemSpellPF } from "./module/item/types/spell.js";
import { ItemWeaponPF } from "./module/item/types/weapon.js";
import { ItemBasePF } from "./module/item/base.js";
import { ItemSheetPF } from "./module/item/sheets/base.js";
import { ItemSheetPF_Container } from "./module/item/sheets/container.js";
import { getChangeFlat, getSourceInfo } from "./module/actor/apply-changes.js";
import { CompendiumDirectoryPF } from "./module/sidebar/compendium.js";
import { CompendiumBrowser } from "./module/apps/compendium-browser.js";
import "./module/patch-core.js";
import { DicePF } from "./module/dice.js";
import { RollPF } from "./module/roll.js";
import { AbilityTemplate } from "./module/pixi/ability-template.js";
import { AttackDialog } from "./module/item/attack-dialog.js";
import {
  getItemOwner,
  sizeDieExt,
  sizeReach,
  normalDie,
  getActorFromId,
  createTag,
  measureDistance,
  convertWeight,
  convertWeightBack,
  convertDistance,
  convertDistanceBack,
  getBuffTargets,
  getBuffTargetDictionary,
  binarySearch,
  sortArrayByName,
  findInCompendia,
  getFirstActiveGM,
  isMinimumCoreVersion,
  refreshActors,
  diffObjectAndArray,
} from "./module/lib.js";
import { getAbilityModifier } from "./module/actor/lib.mjs";
import { ChatMessagePF, customRolls } from "./module/sidebar/chat-message.js";
import { ChatAttack } from "./module/misc/chat-attack.js";
import { TokenQuickActions } from "./module/token-quick-actions.js";
import { initializeSocket } from "./module/socket.js";
import { SemanticVersion } from "./module/semver.js";
import { registerTests } from "./module/test";
import { ChangeLogWindow } from "./module/apps/change-log.js";
import { HelpBrowserPF } from "./module/apps/help-browser.js";
import { addReachListeners } from "./module/misc/attack-reach.js";
import { TooltipPF } from "./module/hud/tooltip.js";
import { dialogGetNumber, dialogGetActor } from "./module/dialog.js";
import * as chat from "./module/chat.js";
import * as migrations from "./module/migration.js";
import * as macros from "./module/macros.js";
import * as controls from "./module/controls.js";
import * as ItemAttack from "./module/item/attack.js";
import { addLowLightVisionToLightConfig, addLowLightVisionToTokenConfig } from "./module/low-light-vision.js";
import { initializeModules } from "./module/modules.js";
import { ItemChange } from "./module/item/components/change.js";
import { ItemScriptCall } from "./module/item/components/script-call.js";
import { ItemAction } from "./module/item/components/action.js";
import { ItemActionSheet } from "./module/item/components/sheets/action.js";
import { ItemConditional, ItemConditionalModifier } from "./module/item/components/conditionals.js";
import { ActionChooser } from "./module/apps/action-chooser.js";
import { Widget_CategorizedItemPicker } from "./module/widgets/categorized-item-picker.js";
import { CurrencyTransfer } from "./module/apps/currency-transfer.js";
import { BaseRegistry } from "./module/registry/base-registry.js";
import { DamageTypes } from "./module/registry/damage-types.js";
import { ScriptCalls } from "./module/registry/script-call.js";

import "./less/pf1.less";
import "./module/hmr.js";

// OBSOLETE: Add String.format
if (!String.prototype.format) {
  /**
   * Replaces `{<number>}` elements in this string with the provided arguments.
   *
   * @deprecated
   * @param {string[]} args - The arguments to replace the `{<number>}` elements with.
   * @returns {string} String with `{<number>}` elements replaced.
   */
  String.prototype.format = function (...args) {
    return this.replace(/{(\d+)}/g, function (match, number) {
      return args[number] != null ? args[number] : match;
    });
  };
}

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once("init", function () {
  console.log(`PF1 | Initializing Pathfinder 1 System`);

  // Redirect notifications to console before Notifications is ready
  ui.notifications = { info: console.log, warn: console.warn, error: console.error };

  // Register client settings
  registerClientSettings();

  // Create a PF1 namespace within the game global
  game.pf1 = {
    polymorphism: { ActorBasePF, ItemBasePF },
    documents: { ActorPF, ItemPF, TokenDocumentPF },
    get entities() {
      // OBSOLETION WARNING
      console.error("game.pf1.entities is obsolete; please use game.pf1.documents instead.");
      return this.documents;
    },
    applications: {
      // Actors
      ActorSheetPF,
      ActorSheetPFCharacter,
      ActorSheetPFNPC,
      ActorSheetPFNPCLite,
      ActorSheetPFNPCLoot,
      // Items
      ItemSheetPF,
      ItemSheetPF_Container,
      // Document Components
      ItemActionSheet,
      // Misc
      AttackDialog,
      ActorSheetFlags,
      ActorRestDialog,
      ActorTraitSelector,
      SensesSelector,
      CompendiumDirectoryPF,
      CompendiumBrowser,
      EntrySelector,
      LevelUpForm,
      PointBuyCalculator,
      ScriptEditor,
      SidebarPF,
      TooltipPF,
      HelpBrowserPF,
      ExperienceDistributor,
      SkillEditor,
      DamageTypeSelector,
      ActionChooser,
      // Widgets
      Widget_CategorizedItemPicker,
      CurrencyTransfer,
    },
    compendiums: {},
    // Rolling
    DicePF,
    rollPreProcess: {
      sizeRoll: sizeDieExt,
      sizeReach: sizeReach,
      roll: normalDie,
    },
    //Chat
    chat: {
      ChatAttack,
      ChatMessagePF,
      events: { targetACClick: chat.targetACClick, targetSavingThrowClick: chat.targetSavingThrowClick },
    },
    // Utility
    utils: {
      createTag,
      getItemOwner,
      getActorFromId,
      getAbilityModifier,
      getChangeFlat,
      getSourceInfo,
      convertDistance,
      convertDistanceBack,
      convertWeight,
      convertWeightBack,
      measureDistance,
      measureDistances,
      measureReachDistance(p0, p1, alt = false) {
        // OBSOLETE: Wrapper for compatibility with old. Remove later.
        console.warn(
          'measureReachDistance is obsolete, please use measureDistance with diagonalRule set to "555" instead'
        );
        return measureDistance(p0, p1, { diagonalRule: alt ? "555" : "5105" });
      },
      dialogGetActor,
      dialogGetNumber,
      SemanticVersion,
      isMinimumCoreVersion,
      binarySearch,
      sortArrayByName,
      findInCompendia,
      getFirstActiveGM,
      refreshActors,
      diffObjectAndArray,
    },
    // Components
    documentComponents: {
      ItemChange,
      ItemAction,
      ItemConditional,
      ItemConditionalModifier,
      ItemScriptCall,
    },
    // API
    baseRegistry: BaseRegistry,
    damageTypes: new DamageTypes(),
    scriptCalls: new ScriptCalls(),
    // Macros
    macros,
    rollItemMacro: macros.rollItemMacro,
    rollSkillMacro: macros.rollSkillMacro,
    rollSaveMacro: macros.rollSaveMacro,
    rollDefenses: macros.rollDefenses,
    rollActorAttributeMacro: macros.rollActorAttributeMacro,
    // Migrations
    migrations,
    migrateWorld: migrations.migrateWorld,
    isMigrating: false,
    // Misc
    config: PF1,
    tooltip: null,
    AbilityTemplate,
    ItemAttack: { ...ItemAttack },
    controls,
    // Variables controlled by control configuration
    skipConfirmPrompt: false,
    tokenTooltip: {
      hide: false,
      hideGMInfo: false,
    },
    forceShowItem: false,
    // Function library
    functions: {
      getBuffTargets,
      getBuffTargetDictionary,
    },
    // Singleton instance of the help browser
    helpBrowser: new HelpBrowserPF(),
  };

  // Global exports
  globalThis.RollPF = RollPF;

  // Record Configuration Values
  CONFIG.PF1 = PF1;
  CONFIG.Canvas.layers.templates.layerClass = TemplateLayerPF;
  CONFIG.Canvas.layers.sight.layerClass = SightLayerPF;
  CONFIG.AmbientLight.objectClass = AmbientLightPF;
  CONFIG.MeasuredTemplate.objectClass = MeasuredTemplatePF;
  CONFIG.MeasuredTemplate.defaults.angle = 90; // PF1 uses 90 degree angles
  CONFIG.Actor.documentClass = ActorBasePF;
  CONFIG.Actor.documentClasses = {
    default: ActorPF, // fallback
    // Specific types
    character: ActorCharacterPF,
    npc: ActorNPCPF,
    basic: BasicActorPF,
  };
  CONFIG.Token.documentClass = TokenDocumentPF;
  CONFIG.Token.objectClass = TokenPF;
  CONFIG.ActiveEffect.documentClass = ActiveEffectPF;
  CONFIG.Item.documentClass = ItemBasePF;
  CONFIG.Item.documentClasses = {
    default: ItemPF, // Fallback
    // Specific types
    attack: ItemAttackPF,
    buff: ItemBuffPF,
    class: ItemClassPF,
    consumable: ItemConsumablePF,
    container: ItemContainerPF,
    equipment: ItemEquipmentPF,
    feat: ItemFeatPF,
    loot: ItemLootPF,
    race: ItemRacePF,
    spell: ItemSpellPF,
    weapon: ItemWeaponPF,
    // etc.
  };
  CONFIG.Combat.documentClass = CombatPF;
  CONFIG.ui.compendium = CompendiumDirectoryPF;
  CONFIG.ChatMessage.documentClass = ChatMessagePF;
  CONFIG.Dice.rolls.splice(0, 0, RollPF);

  CONFIG.time.roundTime = 6;

  // Register System Settings
  registerSystemSettings();

  //Calculate conditions for world
  CONFIG.statusEffects = getConditions();

  // Preload Handlebars Templates
  preloadHandlebarsTemplates();
  registerHandlebarsHelpers();

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("PF1", ActorSheetPFCharacter, {
    label: "PF1.Sheet.PC",
    types: ["character"],
    makeDefault: true,
  });
  Actors.registerSheet("PF1", ActorSheetPFNPC, { label: "PF1.Sheet.NPC", types: ["npc"], makeDefault: true });
  Actors.registerSheet("PF1", ActorSheetPFNPCLite, { label: "PF1.Sheet.NPCLite", types: ["npc"], makeDefault: false });
  Actors.registerSheet("PF1", ActorSheetPFNPCLoot, { label: "PF1.Sheet.NPCLoot", types: ["npc"], makeDefault: false });
  Actors.registerSheet("PF1", ActorSheetPFBasic, { label: "PF1.Sheet.Basic", types: ["basic"], makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("PF1", ItemSheetPF, {
    label: "PF1.Sheet.Item",
    types: ["class", "feat", "spell", "consumable", "equipment", "loot", "weapon", "buff", "attack", "race"],
    makeDefault: true,
  });
  Items.registerSheet("PF1", ItemSheetPF_Container, {
    label: "PF1.Sheet.Container",
    types: ["container"],
    makeDefault: true,
  });

  // Initialize socket listener
  initializeSocket();

  // Initialize module integrations
  initializeModules();

  // Token tooltip status
  game.pf1.tokenTooltip.hide = game.settings.get("pf1", "tooltipConfig")?.hideWithoutKey ?? false;

  // Call post-init hook
  Hooks.callAll("pf1.postInit");
});

Hooks.on("quenchReady", () => {
  registerTests();
});

/* -------------------------------------------- */
/*  Foundry VTT Setup                           */
/* -------------------------------------------- */

/**
 * This function runs after game data has been requested and loaded from the servers, so documents exist
 */
Hooks.once("setup", function () {
  // Localize CONFIG objects once up-front
  const toLocalize = [
    "abilities",
    "abilitiesShort",
    "alignments",
    "currencies",
    "distanceUnits",
    "itemActionTypes",
    "senses",
    "skills",
    "targetTypes",
    "timePeriods",
    "timePeriodsShort",
    "savingThrows",
    "ac",
    "acValueLabels",
    "featTypes",
    "featTypesPlurals",
    "conditions",
    "lootTypes",
    "flyManeuverabilities",
    "abilityTypes",
    "spellPreparationModes",
    "weaponGroups",
    "weaponTypes",
    "weaponProperties",
    "spellComponents",
    "spellSchools",
    "spellLevels",
    "conditionTypes",
    "favouredClassBonuses",
    "armorProficiencies",
    "weaponProficiencies",
    "actorSizes",
    "abilityActivationTypes",
    "abilityActivationTypesPlurals",
    "limitedUsePeriods",
    "equipmentTypes",
    "equipmentSlots",
    "consumableTypes",
    "attackTypes",
    "buffTypes",
    // "buffTargets",
    // "contextNoteTargets",
    "healingTypes",
    "divineFocus",
    "classSavingThrows",
    "classBAB",
    "classTypes",
    "measureTemplateTypes",
    "creatureTypes",
    "measureUnits",
    "measureUnitsShort",
    "languages",
    "weaponHoldTypes",
    "auraStrengths",
    "conditionalTargets",
    "bonusModifiers",
    "abilityActivationTypes_unchained",
    "abilityActivationTypesPlurals_unchained",
    "actorStatures",
    "ammoTypes",
  ];

  // Config (sub-)objects to be sorted
  const toSort = [
    // "buffTargets",
    // "buffTargets.misc",
    // "contextNoteTargets",
    // "contextNoteTargets.misc",
    "skills",
    "conditions",
    "conditionTypes",
    "consumableTypes",
    "creatureTypes",
    "featTypes",
    "weaponProperties",
    "spellSchools",
    "languages",
  ];

  /**
   * Helper function to recursively localize object entries
   *
   * @param {object} obj - The object to be localized
   * @param {string} cat - The object's name
   * @returns {object} The localized object
   */
  const doLocalize = (obj, cat) => {
    // Create tuples of (key, localized object/string)
    const localized = Object.entries(obj).reduce((arr, e) => {
      if (typeof e[1] === "string") arr.push([e[0], game.i18n.localize(e[1])]);
      else if (typeof e[1] === "object") arr.push([e[0], doLocalize(e[1], `${cat}.${e[0]}`)]);
      return arr;
    }, []);
    if (toSort.includes(cat)) {
      // Sort simple strings, fall back to sorting by label for objects/categories
      localized.sort((a, b) => {
        const localA = typeof a?.[1] === "string" ? a[1] : a[1]?._label;
        const localB = typeof b?.[1] === "string" ? b[1] : b[1]?._label;
        // Move misc to bottom of every list
        if (a[0] === "misc") return 1;
        else if (b[0] === "misc") return -1;
        // Regular sorting of localized strings
        return localA.localeCompare(localB);
      });
    }
    // Get the localized and sorted object out of tuple
    return localized.reduce((obj, e) => {
      obj[e[0]] = e[1];
      return obj;
    }, {});
  };

  // Localize and sort CONFIG objects
  for (const o of toLocalize) {
    CONFIG.PF1[o] = doLocalize(CONFIG.PF1[o], o);
  }

  // Localize buff targets
  const localizeLabels = ["buffTargets", "buffTargetCategories", "contextNoteTargets", "contextNoteCategories"];
  for (const l of localizeLabels) {
    for (const [k, v] of Object.entries(CONFIG.PF1[l])) {
      CONFIG.PF1[l][k].label = game.i18n.localize(v.label);
    }
  }

  // TinyMCE variables and commands
  tinyMCEInit();

  // Register controls
  game.pf1.controls.registerSystemControls();

  Hooks.callAll("pf1.postSetup");
});

/* -------------------------------------------- */

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", async function () {
  // Create tooltip
  game.pf1.tooltip = null;
  const ttconf = game.settings.get("pf1", "tooltipConfig");
  const ttwconf = game.settings.get("pf1", "tooltipWorldConfig");
  if (!ttconf.disable && !ttwconf.disable) TooltipPF.toggle(true);

  window.addEventListener("resize", () => {
    game.pf1.tooltip?.setPosition();
  });

  // Migrate data
  const NEEDS_MIGRATION_VERSION = "0.81.0";
  let PREVIOUS_MIGRATION_VERSION = game.settings.get("pf1", "systemMigrationVersion");
  if (typeof PREVIOUS_MIGRATION_VERSION === "number") {
    PREVIOUS_MIGRATION_VERSION = PREVIOUS_MIGRATION_VERSION.toString() + ".0";
  } else if (
    typeof PREVIOUS_MIGRATION_VERSION === "string" &&
    PREVIOUS_MIGRATION_VERSION.match(/^([0-9]+)\.([0-9]+)$/)
  ) {
    PREVIOUS_MIGRATION_VERSION = `${PREVIOUS_MIGRATION_VERSION}.0`;
  }
  const needMigration = SemanticVersion.fromString(NEEDS_MIGRATION_VERSION).isHigherThan(
    SemanticVersion.fromString(PREVIOUS_MIGRATION_VERSION)
  );
  if (needMigration && game.user.isGM) {
    await migrations.migrateWorld();
  }

  // Migrate system settings
  await migrateSystemSettings();

  // Create compendium browsers
  game.pf1.compendiums = {
    spells: new CompendiumBrowser({ type: "spells" }),
    items: new CompendiumBrowser({ type: "items" }),
    bestiary: new CompendiumBrowser({ type: "bestiary" }),
    feats: new CompendiumBrowser({ type: "feats" }),
    classes: new CompendiumBrowser({ type: "classes" }),
    races: new CompendiumBrowser({ type: "races" }),
    buffs: new CompendiumBrowser({ type: "buffs" }),
  };

  // Show changelog
  if (!game.settings.get("pf1", "dontShowChangelog")) {
    const v = game.settings.get("pf1", "changelogVersion") || "0.0.1";
    const changelogVersion = SemanticVersion.fromString(v);
    const curVersion = SemanticVersion.fromString(game.system.data.version);

    if (curVersion.isHigherThan(changelogVersion)) {
      const app = new ChangeLogWindow(changelogVersion);
      app.render(true, { focus: true });
      game.settings.set("pf1", "changelogVersion", curVersion.toString());
    }
  }

  Hooks.callAll("pf1.postReady");
});

/* -------------------------------------------- */
/*  Canvas Initialization                       */
/* -------------------------------------------- */

Hooks.on("canvasInit", function () {
  // Extend Diagonal Measurement
  canvas.grid.diagonalRule = game.settings.get("pf1", "diagonalMovement");
  SquareGrid.prototype.measureDistances = measureDistances;
});

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", (app, html, data) => {
  // Hide roll info
  chat.hideRollInfo(app, html, data);

  // Hide GM sensitive info
  chat.hideGMSensitiveInfo(app, html, data);

  // Hide non-visible targets for players
  if (!game.user.isGM) chat.hideInvisibleTargets(app, html);

  // Create target callbacks
  chat.addTargetCallbacks(app, html);

  // Alter target defense options
  chat.alterTargetDefense(app, html);

  // Optionally collapse the content
  if (game.settings.get("pf1", "autoCollapseItemCards")) html.find(".card-content").hide();

  // Optionally hide chat buttons
  if (game.settings.get("pf1", "hideChatButtons")) html.find(".card-buttons").hide();

  // Apply accessibility settings to chat message
  chat.applyAccessibilitySettings(app, html, data, game.settings.get("pf1", "accessibilityConfig"));

  // Alter chat card title color
  chat.addChatCardTitleGradient(app, html, data);

  // Alter ammo recovery options
  chat.alterAmmoRecovery(app, html);

  // Handle chat tooltips
  html.find(".tooltip").on("mousemove", (ev) => handleChatTooltips(ev));
});

Hooks.on("renderChatPopout", (app, html, data) => {
  // Optionally collapse the content
  if (game.settings.get("pf1", "autoCollapseItemCards")) html.find(".card-content").hide();

  // Optionally hide chat buttons
  if (game.settings.get("pf1", "hideChatButtons")) html.find(".card-buttons").hide();
});

Hooks.on("renderChatLog", (_, html) => ItemPF.chatListeners(html));
Hooks.on("renderChatLog", (_, html) => ActorPF.chatListeners(html));
Hooks.on("renderChatLog", (_, html) => addReachListeners(html));

Hooks.on("renderChatPopout", (_, html) => ItemPF.chatListeners(html));
Hooks.on("renderChatPopout", (_, html) => ActorPF.chatListeners(html));

Hooks.on("renderAmbientLightConfig", (app, html) => {
  addLowLightVisionToLightConfig(app, html);
});

Hooks.on("renderTokenHUD", (app, html, data) => {
  TokenQuickActions.addTop3Attacks(app, html, data);
});

Hooks.on("preCreateActor", (actor, data, options, userId) => {
  if (data.type === "character") {
    actor.data._source.token.actorLink = true;
  }
});

Hooks.on("updateActor", (actor, data, options, userId) => {
  // Call hook for toggling conditions
  {
    const conditions = getProperty(data, "data.attributes.conditions") || {};
    for (const [k, v] of Object.entries(conditions)) {
      Hooks.callAll("pf1.toggleActorCondition", actor, k, v);
    }
  }
});

Hooks.on("preCreateToken", async (scene, token, options, userId) => {
  const actor = game.actors.get(token.actorId);
  if (!actor?._calcBuffActiveEffects) return; // Don't do anything for actors without this function (e.g. basic actors)
  const buffTextures = Object.values(actor?._calcBuffActiveEffects() ?? []).map((b) => b.icon);
  for (const icon of buffTextures) if (icon) await loadTexture(icon);
});

Hooks.on("createToken", (token, options, userId) => {
  if (game.user.id !== userId) return;
  // Re-associate imported Active Effects which are sourced to Items owned by this same Actor
  if (token.actor.effects?.size) {
    const updates = [];
    for (const effect of token.actor.effects) {
      if (!effect.data.origin) continue;
      const effectItemId = effect.data.origin.match(/Item\.(\w+)/)?.pop();
      const foundItem = token.actor.items.get(effectItemId);
      if (foundItem) {
        updates.push({ _id: effect.id, origin: foundItem.uuid });
      }
    }
    token.actor.updateEmbeddedDocuments("ActiveEffect", updates, { render: false });
  }
});

Hooks.on("preDeleteToken", (token, options, userId) => {
  // Hide token tooltip on token deletion
  game.pf1.tooltip?.unbind(token.object);
});

Hooks.on("updateToken", function (token, updateData, options, userId) {
  // Hide token tooltip on token update
  game.pf1.tooltip?.unbind(token);

  // Update token's actor sheet (if any)
  token.actor?.sheet?.render();
});

Hooks.on("controlToken", (token, selected) => {
  // Refresh canvas sight
  canvas.perception.schedule({
    lighting: { initialize: true, refresh: true },
    sight: { initialize: true, refresh: true },
    sounds: { refresh: true },
    foreground: { refresh: true },
  });
});

Hooks.on("createItem", (item, options, userId) => {
  const actor = item.parent instanceof ActorPF ? item.parent : null;
  if (userId !== game.user.id) return;

  // Show buff if active
  if (item.type === "buff" && getProperty(item.data, "data.active") === true) {
    // Call hook
    if (actor) {
      Hooks.callAll("pf1.toggleActorBuff", actor, item.data, true);
    }

    // Execute script calls
    item.executeScriptCalls("toggle", { state: true });
  }
  // Simulate toggling a feature on
  if (item.type === "feat") {
    const disabled = getProperty(item.data, "data.disabled");
    if (disabled === false) {
      item.executeScriptCalls("toggle", { state: true });
    }
  }
  // Simulate equipping items
  {
    const equipped = getProperty(item.data, "data.equipped");
    if (equipped === true) {
      item.executeScriptCalls("equip", { equipped: true });
    }
  }
  // Quantity change
  {
    const quantity = getProperty(item.data, "data.quantity");
    if (typeof quantity === "number" && quantity > 0) {
      item.executeScriptCalls("changeQuantity", { quantity: { previous: 0, new: quantity } });
    }
  }
});

Hooks.on("preDeleteItem", (item, options, userId) => {
  if (item.actor) {
    // Remove linked children with item
    const _getChildren = function (item) {
      const result = [];
      const itemLinks = getProperty(item.data, "data.links");
      if (itemLinks) {
        for (const [linkType, links] of Object.entries(itemLinks)) {
          for (const link of links) {
            if (linkType === "children") {
              const child = item.actor.items.get(link.id);
              result.push(link.id);
              if (child) {
                const childChildren = _getChildren(child);
                result.push(...childChildren);
              }
            }
          }
        }
      }
      return result;
    };

    const children = _getChildren(item);
    const toRemove = [item.id, ...children]
      .reduce((cur, o) => {
        if (!cur.includes(o)) cur.push(o);
        return cur;
      }, [])
      .filter((o) => item.actor.items.has(o));

    if (children.length > 0 && !options.handledChildren) {
      CONFIG.Item.documentClass.deleteDocuments(toRemove, {
        parent: item.actor,
        handledChildren: true,
      });
      return false;
    }
  }
});

Hooks.on("deleteItem", async (item, options, userId) => {
  if (userId !== game.user.id) return;
  const actor = item.parent instanceof ActorPF ? item.parent : null;

  if (actor) {
    // Remove token effects for deleted buff
    const isLinkedToken = getProperty(actor.data, "token.actorLink");
    if (isLinkedToken) {
      const promises = [];
      if (item.data.type === "buff" && item.data.data.active) {
        actor.effects.find((e) => e.data.origin?.indexOf(item.data.id) > 0)?.delete();
        const tokens = actor.getActiveTokens();
        for (const token of tokens) {
          promises.push(token.toggleEffect(item.data.img, { active: false }));
        }
      }
      await Promise.all(promises);
    }

    // Remove links
    const itemLinks = getProperty(item.data, "data.links");
    if (itemLinks) {
      for (const [linkType, links] of Object.entries(itemLinks)) {
        for (const link of links) {
          const item = actor.items.get(link.id);
          const otherItemLinks = item?.links || {};
          if (otherItemLinks[linkType]) {
            delete otherItemLinks[linkType];
          }
        }
      }
    }

    // Call buff removal hook
    if (item.type === "buff" && getProperty(item.data, "data.active") === true) {
      Hooks.callAll("pf1.toggleActorBuff", actor, item.data, false);
    }
  }

  if (item.type === "buff" && getProperty(item.data, "data.active") === true) {
    item.executeScriptCalls("toggle", { state: false });
  }
  // Simulate toggling a feature on
  if (item.type === "feat") {
    const disabled = getProperty(item.data, "data.disabled");
    if (disabled === false) {
      item.executeScriptCalls("toggle", { state: false });
    }
  }
  // Simulate equipping items
  {
    const equipped = getProperty(item.data, "data.equipped");
    if (equipped === true) {
      item.executeScriptCalls("equip", { equipped: false });
    }
  }
  // Quantity change
  {
    const quantity = getProperty(item.data, "data.quantity");
    if (typeof quantity === "number" && quantity > 0) {
      item.executeScriptCalls("changeQuantity", { quantity: { previous: quantity, new: 0 } });
    }
  }
});

Hooks.on("updateItem", async (item, changedData, options, userId) => {
  if (userId !== game.user.id) return;
  const actor = item.parent instanceof ActorPF ? item.parent : null;

  if (actor) {
    // Toggle buff
    if (item.type === "buff" && getProperty(changedData, "data.active") !== undefined) {
      // Call hook
      Hooks.callAll("pf1.toggleActorBuff", actor, item.data, getProperty(changedData, "data.active"));
    }
  }
});

Hooks.on("chatMessage", (log, message, chatData) => {
  const result = customRolls(message, chatData.speaker);
  return !result;
});

Hooks.on("renderActorDirectory", (app, html, data) => {
  html.find("li.actor").each((i, li) => {
    li.addEventListener("drop", CurrencyTransfer._directoryDrop.bind(undefined, li.getAttribute("data-document-id")));
  });
});

Hooks.on("renderItemDirectory", (app, html, data) => {
  html.find("li.item").each((i, li) => {
    li.addEventListener("drop", CurrencyTransfer._directoryDrop.bind(undefined, li.getAttribute("data-document-id")));
  });
});

Hooks.on("dropActorSheetData", (act, sheet, data) => {
  if (data.type === "Currency") sheet._onDropCurrency(event, data);
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

Hooks.on("hotbarDrop", (bar, data, slot) => {
  let macro;
  if (data.type === "Item") macro = macros.createItemMacro(data.data, data.actor, slot);
  else if (data.type === "skill") macro = macros.createSkillMacro(data.skill, data.actor, slot);
  else if (data.type === "save") macro = macros.createSaveMacro(data.altType, data.actor, slot);
  else if (["defenses", "cmb", "concentration", "cl", "bab"].includes(data.type))
    macro = macros.createMiscActorMacro(data.type, data.actor, slot, data.altType);
  else return true;

  if (macro === undefined) return false;
});

// Render TokenConfig
Hooks.on("renderTokenConfig", async (app, html) => {
  const TokenData = foundry.data.TokenData;
  // Add vision inputs
  let object = app.object;
  // Prototype token
  if (object instanceof Actor) object = object.data.token;
  // Regular token
  else if (object instanceof TokenDocument) object = object.data;

  // Add static size checkbox
  let newHTML = `<div class="form-group"><label>${game.i18n.localize(
    "PF1.StaticSize"
  )}</label><input type="checkbox" name="flags.pf1.staticSize" data-dtype="Boolean"`;
  if (getProperty(object, "flags.pf1.staticSize")) newHTML += " checked";
  newHTML += "/></div>";
  html.find('.tab[data-tab="appearance"] > *:nth-child(3)').after(newHTML);

  // Add custom vision checkbox
  newHTML = `<div class="form-group" title="${game.i18n.localize(
    "PF1.CustomVisionRules.Description"
  )}"><label>${game.i18n.localize(
    "PF1.CustomVisionRules.Label"
  )}</label><input type="checkbox" name="flags.pf1.customVisionRules" data-dtype="Boolean"`;
  if (getProperty(object, "flags.pf1.customVisionRules")) newHTML += " checked";
  newHTML += "/></div>";
  html.find(`.tab[data-tab="vision"]`).append(newHTML);

  // Add disable low-light vision checkbox
  addLowLightVisionToTokenConfig(app, html);
});

// Render Sidebar
Hooks.on("renderSidebarTab", (app, html) => {
  if (app instanceof Settings) {
    // Add buttons
    const chlogButton = $(`<button>${game.i18n.localize("PF1.Changelog")}</button>`);
    const helpButton = $(`<button>${game.i18n.localize("PF1.Help.Label")}</button>`);
    html
      .find("#game-details")
      .after(
        $(`<h2>${game.i18n.localize("PF1.title")}</h2>`),
        $("<div id='pf1-details'>").append(chlogButton, helpButton)
      );

    chlogButton.click(() => {
      const chlog = Object.values(ui.windows).find((o) => o.id == "changelog") ?? new ChangeLogWindow();
      chlog.render(true, { focus: true });
    });
    helpButton.click(() => game.pf1.helpBrowser.openUrl("Help/Home"));
  }
});

// Add compendium sidebar context options
Hooks.on("getCompendiumDirectoryPFEntryContext", (html, entryOptions) => {
  // Add option to disable pack
  entryOptions.push({
    name: game.i18n.localize("PF1.Disable"),
    icon: '<i class="fas fa-low-vision"></i>',
    callback: (li) => {
      const pack = game.packs.get(li.data("pack"));
      const config = game.settings.get("core", "compendiumConfiguration")[pack.collection];
      const disabled = getProperty(config, "pf1.disabled") === true;
      pack.configure({ "pf1.disabled": !disabled });
    },
  });
});

// Show experience distributor after combat
Hooks.on("deleteCombat", (combat, options, userId) => {
  const isGM = game.user.isGM;
  const skipPrompt = getSkipActionPrompt();
  const { disableExperienceTracking, openXpDistributor } = game.settings.get("pf1", "experienceConfig");
  if (
    isGM &&
    !disableExperienceTracking &&
    combat.started &&
    ((openXpDistributor && !skipPrompt) || (!openXpDistributor && skipPrompt))
  ) {
    const combatants = combat.combatants.map((o) => o.actor);
    const app = new ExperienceDistributor(combatants);

    if (app.getCharacters().length > 0) {
      app.render(true);
    } else {
      app.close();
    }
  }
});

/* ------------------------------- */
/* Expire active effects
/* ------------------------------- */
{
  const expireFromTokens = function () {
    if (getFirstActiveGM() === game.user) {
      for (const t of canvas.tokens.placeables) {
        // Skip tokens in combat to avoid too early expiration
        if (t.combatant?.combat?.started) continue;
        // Don't do anything for actors without this function (e.g. basic actors)
        if (!t.actor?.expireActiveEffects) continue;
        t.actor.expireActiveEffects();
      }
    }
  };

  // On game time change
  Hooks.on("updateWorldTime", () => {
    expireFromTokens();
  });

  // On canvas render
  Hooks.on("canvasReady", () => {
    expireFromTokens();
  });
}

// Handle chat tooltips
const handleChatTooltips = function (event) {
  const elem = $(event.currentTarget);
  const rect = event.currentTarget.getBoundingClientRect();
  // const x = event.pageX;
  // const y = event.pageY;
  const x = rect.x;
  const y = rect.y;
  const w = rect.width;
  elem.find(".tooltipcontent").css("left", `${x}px`).css("top", `${y}px`).css("width", `${w}px`);
};

/* ------------------------------- */
/* Class exports                   */
/* ------------------------------- */
// Actor classes
export { ActorBasePF, ActorPF, ActorCharacterPF, ActorNPCPF, BasicActorPF };

// Item classes
export {
  ItemBasePF,
  ItemPF,
  ItemAttackPF,
  ItemBuffPF,
  ItemClassPF,
  ItemConsumablePF,
  ItemContainerPF,
  ItemEquipmentPF,
  ItemFeatPF,
  ItemLootPF,
  ItemRacePF,
  ItemSpellPF,
  ItemWeaponPF,
};

// Item component classes
export { ItemChange, ItemAction };

// Actor sheets
export {
  ActorSheetPFBasic,
  ActorSheetPF,
  ActorSheetPFCharacter,
  ActorSheetPFNPCLite,
  ActorSheetPFNPCLoot,
  ActorSheetPFNPC,
};

// Item sheets
export { ItemSheetPF, ItemSheetPF_Container };

// Item component sheets
export { ItemActionSheet };

// Token
export { TokenPF, TokenDocumentPF };

// Chat Message
export { ChatMessagePF };

// Measured Template
export { MeasuredTemplatePF };
