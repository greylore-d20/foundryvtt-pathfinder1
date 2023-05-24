/* eslint-disable no-case-declarations */
/**
 * The Pathfinder 1st edition game system for Foundry Virtual Tabletop
 * Author: Furyspark
 * Software License: GNU GPLv3
 */

// Import Modules
import { PF1 } from "./module/config.mjs";
import {
  registerSystemSettings,
  registerClientSettings,
  migrateSystemSettings,
  getSkipActionPrompt,
} from "./module/documents/settings.mjs";
import { preloadHandlebarsTemplates } from "./module/utils/handlebars/templates.mjs";
import { registerHandlebarsHelpers } from "./module/utils/handlebars/helpers.mjs";
import { tinyMCEInit } from "./module/mce/mce.mjs";
import { measureDistances, getConditions } from "./module/utils/canvas.mjs";
import { TemplateLayerPF } from "./module/canvas/measure.mjs";
import { MeasuredTemplatePF } from "./module/canvas/measure.mjs";
import { ActorBasePF } from "./module/documents/actor/actor-base.mjs";
import { ActorPF } from "./module/documents/actor/actor-pf.mjs";
import { ActorCharacterPF } from "./module/documents/actor/actor-character.mjs";
import { ActorNPCPF } from "./module/documents/actor/actor-npc.mjs";
import { BasicActorPF } from "./module/documents/actor/actor-basic.mjs";
import { ActorSheetPF } from "./module/applications/actor/actor-sheet.mjs";
import { ActorSheetPFCharacter } from "./module/applications/actor/character-sheet.mjs";
import { ActorSheetPFNPC } from "./module/applications/actor/npc-sheet.mjs";
import { ActorSheetPFNPCLite } from "./module/applications/actor/npc-lite-sheet.mjs";
import { ActorSheetPFNPCLoot } from "./module/applications/actor/npc-loot-sheet.mjs";
import { ActorSheetPFBasic } from "./module/applications/actor/basic-sheet.mjs";
import { ActorSheetFlags } from "./module/applications/actor/actor-flags.mjs";
import { ActorRestDialog } from "./module/applications/actor/actor-rest.mjs";
import { SensesSelector } from "./module/applications/senses-selector.mjs";
import { SkillEditor } from "./module/applications/skill-editor.mjs";
import { CombatPF } from "./module/documents/combat.mjs";
import { TokenPF } from "./module/canvas/token.mjs";
import { TokenDocumentPF } from "./module/documents/token.mjs";
import { EntrySelector } from "./module/applications/entry-selector.mjs";
import { LevelUpForm } from "./module/applications/level-up.mjs";
import { PointBuyCalculator } from "./module/applications/point-buy-calculator.mjs";
import { ScriptEditor } from "./module/applications/script-editor.mjs";
import { ActorTraitSelector } from "./module/applications/trait-selector.mjs";
import { ExperienceDistributor } from "./module/applications/xp-distributor.mjs";
import { DamageTypeSelector } from "./module/applications/damage-type-selector.mjs";
import { ActiveEffectPF } from "./module/documents/active-effect.mjs";
import { ItemPF } from "./module/documents/item/item-pf.mjs";
import { ItemAttackPF } from "./module/documents/item/item-attack.mjs";
import { ItemBuffPF } from "./module/documents/item/item-buff.mjs";
import { ItemClassPF } from "./module/documents/item/item-class.mjs";
import { ItemConsumablePF } from "./module/documents/item/item-consumable.mjs";
import { ItemContainerPF } from "./module/documents/item/item-container.mjs";
import { ItemEquipmentPF } from "./module/documents/item/item-equipment.mjs";
import { ItemFeatPF } from "./module/documents/item/item-feat.mjs";
import { ItemLootPF } from "./module/documents/item/item-loot.mjs";
import { ItemRacePF } from "./module/documents/item/item-race.mjs";
import { ItemSpellPF } from "./module/documents/item/item-spell.mjs";
import { ItemWeaponPF } from "./module/documents/item/item-weapon.mjs";
import { ItemBasePF } from "./module/documents/item/item-base.mjs";
import { ItemSheetPF } from "./module/applications/item/item-sheet.mjs";
import { ItemSheetPF_Container } from "./module/applications/item/container-sheet.mjs";

import { getChangeFlat, getSourceInfo } from "./module/documents/actor/utils/apply-changes.mjs";
import { CompendiumDirectoryPF } from "./module/compendium-directory.mjs";
import "./module/patch-core.mjs";
import { DicePF } from "./module/dice/dice.mjs";
import { RollPF } from "./module/dice/roll.mjs";
import { AbilityTemplate } from "./module/canvas/ability-template.mjs";
import { AttackDialog } from "./module/applications/attack-dialog.mjs";
import {
  getItemOwner,
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
  moduleToObject,
  setDefaultSceneScaling,
} from "./module/utils/lib.mjs";
import { getAbilityModifier } from "@utils";
import { ChatMessagePF, customRolls } from "./module/documents/chat-message.mjs";
import { ChatAttack } from "./module/action-use/chat-attack.mjs";
import { TokenQuickActions } from "./module/canvas/token-quick-actions.mjs";
import { initializeSocket } from "./module/socket.mjs";
import { SemanticVersion } from "./module/utils/semver.mjs";
import { ChangeLogWindow } from "./module/applications/change-log.mjs";
import { HelpBrowserPF } from "./module/applications/help-browser.mjs";
import { addReachListeners } from "./module/canvas/attack-reach.mjs";
import { TooltipPF } from "./module/applications/tooltip.mjs";
import { dialogGetNumber, dialogGetActor } from "./module/utils/dialog.mjs";
import * as chat from "./module/utils/chat.mjs";
import * as migrations from "./module/migration.mjs";
import * as macros from "./module/documents/macros.mjs";
import * as controls from "./module/documents/controls.mjs";
import * as ItemAttack from "./module/action-use/action-use.mjs";
import { addLowLightVisionToLightConfig, addLowLightVisionToTokenConfig } from "./module/canvas/low-light-vision.mjs";
import { initializeModules } from "./module/modules.mjs";
import { ItemChange } from "./module/components/change.mjs";
import { ItemScriptCall } from "./module/components/script-call.mjs";
import { ItemAction } from "./module/components/action.mjs";
import { ItemActionSheet } from "./module/applications/component/action-sheet.mjs";
import { ItemConditional, ItemConditionalModifier } from "./module/components/conditionals.mjs";
import { ActionChooser } from "./module/applications/action-chooser.mjs";
import { Widget_CategorizedItemPicker } from "./module/applications/categorized-item-picker.mjs";
import { CurrencyTransfer } from "./module/applications/currency-transfer.mjs";
import { ItemDirectoryPF } from "./module/applications/_module.mjs";
import { BaseRegistry } from "./module/registry/base-registry.mjs";
import { DamageTypes } from "./module/registry/damage-types.mjs";
import { ScriptCalls } from "./module/registry/script-call.mjs";
import { callOldNamespaceHookAll } from "@utils/hooks.mjs";

import "./less/pf1.less";
import "./module/hmr.mjs";

// New API
import * as applications from "./module/applications/_module.mjs";
import * as documents from "./module/documents/_module.mjs";
import * as actionUse from "./module/action-use/_module.mjs"; // TODO: Change dir name?
import * as _canvas from "./module/canvas/_module.mjs";
import * as dice from "./module/dice/_module.mjs";
import * as components from "./module/components/_module.mjs";
import * as utils from "./module/utils/_module.mjs";
import * as registry from "./module/registry/_module.mjs";
import * as rollPreProcess from "./module/utils/roll-preprocess.mjs";

// ESM exports, to be kept in sync with globalThis.pf1
export {
  actionUse,
  applications,
  _canvas as canvas,
  components,
  PF1 as config,
  dice,
  documents,
  migrations,
  registry,
  utils,
};

globalThis.pf1 = moduleToObject({
  actionUse,
  applications,
  canvas: _canvas,
  components,
  config: PF1,
  dice,
  documents,
  migrations,
  registry,
  /** @type {TooltipPF|null} */
  tooltip: null,
  utils,
  // Initialize skip confirm prompt value
  skipConfirmPrompt: false,
});

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
    foundry.utils.logCompatibilityWarning("String.format() is deprecated and will be removed in future PF1 release.", {
      since: "PF1 0.82.6",
      until: "PF1 0.83.0",
    });

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
  ui.notifications = {
    info: (msg, opts = {}) => (opts.console !== false ? console.log(msg) : undefined),
    warn: (msg, opts = {}) => (opts.console !== false ? console.warn(msg) : undefined),
    error: (msg, opts = {}) => (opts.console !== false ? console.error(msg) : undefined),
  };

  // Register client settings
  registerClientSettings();

  // Create a PF1 namespace within the game global
  const oldPf1 = {
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
      EntrySelector,
      LevelUpForm,
      PointBuyCalculator,
      ScriptEditor,
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
    compendiums: applications.compendiums,
    // Rolling
    DicePF,
    rollPreProcess: {
      ...rollPreProcess,
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
    rollDefenses: macros.displayDefenses,
    rollActorAttributeMacro: macros.rollActorAttributeMacro,
    // Migrations
    migrations,
    migrateWorld: migrations.migrateWorld,
    get isMigrating() {
      return pf1.migrations.isMigrating;
    },
    // Misc
    config: PF1,
    tooltip: null,
    AbilityTemplate,
    ItemAttack: { ...ItemAttack },
    controls,
    // Variables controlled by control configuration
    skipConfirmPrompt: false,
    tokenTooltip: {
      get hide() {
        console.warn("game.pf1.tokenTooltip.hide is obsolete. Use pf1.tooltip.forceHide instead.");
        return pf1.tooltip.forceHide;
      },
      set hide(value) {
        console.warn("game.pf1.tokenTooltip.hide is obsolete. Use pf1.tooltip.forceHide instead.");
        pf1.tooltip.forceHide = value;
      },
      get hideGMInfo() {
        console.warn("game.pf1.tokenTooltip.hideGMInfo is obsolete. Use pf1.tooltip.forceHideGMInfo instead.");
        return pf1.tooltip.forceHideGMInfo;
      },
      set hideGMInfo(value) {
        console.warn("game.pf1.tokenTooltip.hideGMInfo is obsolete. Use pf1.tooltip.forceHideGMInfo instead.");
        pf1.tooltip.forceHideGMInfo = value;
      },
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
  game.pf1 = new Proxy(oldPf1, {
    get(obj, property) {
      foundry.utils.logCompatibilityWarning(
        [
          "You are accessing game.pf1, which will be restructured to match globalThis.pf1 in the future.",
          `Please check whether ${property} and its contents are still available, or use globalThis.pf1 instead.`,
        ].join("\n"),
        { since: "PF1 0.82.0", until: "PF1 0.83.0" }
      );
      return Reflect.get(obj, property);
    },
    set(obj, property, value) {
      foundry.utils.logCompatibilityWarning(
        [
          "You are accessing game.pf1, which will be restructured to match globalThis.pf1 in the future.",
          `Please check whether ${property} and its contents are still available, or use globalThis.pf1 instead.`,
        ].join("\n"),
        { since: "PF1 0.82.0", until: "PF1 0.83.0" }
      );
      return Reflect.set(obj, property, value);
    },
  });

  // Global exports
  globalThis.RollPF = RollPF;

  CONFIG.ui.items = ItemDirectoryPF;

  // Record Configuration Values
  CONFIG.PF1 = PF1;
  CONFIG.Canvas.layers.templates.layerClass = TemplateLayerPF;
  CONFIG.MeasuredTemplate.objectClass = MeasuredTemplatePF;
  CONFIG.MeasuredTemplate.defaults.originalAngle = CONFIG.MeasuredTemplate.defaults.angle;
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
  CONFIG.Dice.rolls.splice(0, 0, dice.RollPF);
  CONFIG.Dice.termTypes.SizeRollTerm = dice.terms.SizeRollTerm;
  CONFIG.Dice.RollPF = dice.RollPF;
  CONFIG.Dice.rolls.push(dice.D20RollPF);
  CONFIG.Dice.rolls.D20RollPF = dice.D20RollPF;
  CONFIG.Dice.rolls.push(dice.DamageRoll);
  CONFIG.Dice.rolls.DamageRoll = dice.DamageRoll;

  CONFIG.time.roundTime = 6;

  // Register System Settings
  registerSystemSettings();

  setDefaultSceneScaling();

  //Calculate conditions for world
  CONFIG.statusEffects = getConditions();

  // Preload Handlebars Templates
  preloadHandlebarsTemplates();
  registerHandlebarsHelpers();

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("pf1", ActorSheetPFCharacter, {
    label: "PF1.Sheet.PC",
    types: ["character"],
    makeDefault: true,
  });
  Actors.registerSheet("pf1", ActorSheetPFNPC, { label: "PF1.Sheet.NPC", types: ["npc"], makeDefault: true });
  Actors.registerSheet("pf1", ActorSheetPFNPCLite, { label: "PF1.Sheet.NPCLite", types: ["npc"], makeDefault: false });
  Actors.registerSheet("pf1", ActorSheetPFNPCLoot, { label: "PF1.Sheet.NPCLoot", types: ["npc"], makeDefault: false });
  Actors.registerSheet("pf1", ActorSheetPFBasic, { label: "PF1.Sheet.Basic", types: ["basic"], makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("pf1", ItemSheetPF, {
    label: "PF1.Sheet.Item",
    types: ["class", "feat", "spell", "consumable", "equipment", "loot", "weapon", "buff", "attack", "race"],
    makeDefault: true,
  });
  Items.registerSheet("pf1", ItemSheetPF_Container, {
    label: "PF1.Sheet.Container",
    types: ["container"],
    makeDefault: true,
  });

  // Alter configuration
  CONFIG.specialStatusEffects.BLIND = "pf1_blind";

  // Register detection modes
  for (const mode of Object.values(pf1.canvas.detectionModes)) {
    CONFIG.Canvas.detectionModes[mode.ID] = new mode({
      id: mode.ID,
      label: mode.LABEL,
      type: mode.DETECTION_TYPE || DetectionMode.DETECTION_TYPES.SIGHT,
    });
  }

  // Initialize socket listener
  initializeSocket();

  // Initialize module integrations
  initializeModules();

  // Call post-init hook
  callOldNamespaceHookAll("pf1.postInit", "pf1PostInit");
  Hooks.callAll("pf1PostInit");
});

// Load Quench test in development environment
if (import.meta.env.DEV) {
  await import("./module/test/index.mjs");
}

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
    "traitTypes",
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
    PF1[o] = doLocalize(PF1[o], o);
  }

  // Localize buff targets
  const localizeLabels = ["buffTargets", "buffTargetCategories", "contextNoteTargets", "contextNoteCategories"];
  for (const l of localizeLabels) {
    for (const [k, v] of Object.entries(PF1[l])) {
      PF1[l][k].label = game.i18n.localize(v.label);
    }
  }

  // TinyMCE variables and commands
  tinyMCEInit();

  // Register controls
  controls.registerSystemControls();

  callOldNamespaceHookAll("pf1.postSetup", "pf1PostSetup");
  Hooks.callAll("pf1PostSetup");
});

/* -------------------------------------------- */

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", async function () {
  // Create tooltip
  const ttconf = game.settings.get("pf1", "tooltipConfig");
  const ttwconf = game.settings.get("pf1", "tooltipWorldConfig");
  if (!ttconf.disable && !ttwconf.disable) TooltipPF.toggle(true);

  window.addEventListener("resize", () => {
    pf1.tooltip?.setPosition();
  });

  // Migrate data
  const NEEDS_MIGRATION_VERSION = "0.82.4";
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

  // Populate `pf1.applications.compendiums`
  pf1.applications.compendiumBrowser.CompendiumBrowser.initializeBrowsers();

  // Show changelog
  if (!game.settings.get("pf1", "dontShowChangelog")) {
    const v = game.settings.get("pf1", "changelogVersion") || "0.0.1";
    const changelogVersion = SemanticVersion.fromString(v);
    const curVersion = SemanticVersion.fromString(game.system.version);

    if (curVersion.isHigherThan(changelogVersion)) {
      const app = new ChangeLogWindow(changelogVersion);
      app.render(true, { focus: true });
      game.settings.set("pf1", "changelogVersion", curVersion.toString());
    }
  }

  callOldNamespaceHookAll("pf1.postReady", "pf1PostReady");
  Hooks.callAll("pf1PostReady");
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
  TokenQuickActions.addQuickActions(app, html, data);
});

Hooks.on("updateActor", (actor, data, options, userId) => {
  // Call hook for toggling conditions
  {
    const conditions = data.system?.attributes?.conditions || {};
    for (const [k, v] of Object.entries(conditions)) {
      callOldNamespaceHookAll("pf1.toggleActorCondition", "pf1ToggleActorCondition", actor, k, v);
      Hooks.callAll("pf1ToggleActorCondition", actor, k, v);
    }
  }
});

Hooks.on("createToken", (token, options, userId) => {
  if (game.user.id !== userId) return;
  // Re-associate imported Active Effects which are sourced to Items owned by this same Actor
  if (token.actor.effects?.size) {
    const updates = [];
    for (const effect of token.actor.effects) {
      if (!effect.origin) continue;
      const effectItemId = effect.origin.match(/Item\.(\w+)/)?.pop();
      const foundItem = token.actor.items.get(effectItemId);
      if (foundItem) {
        updates.push({ _id: effect.id, origin: foundItem.uuid });
      }
    }
    token.actor.updateEmbeddedDocuments("ActiveEffect", updates, { render: false });
  }
});

Hooks.on("deleteToken", (token, options, userId) => {
  // Hide token tooltip on token deletion
  pf1.tooltip?.unbind(token.object);
});

Hooks.on("updateToken", function (token, updateData, options, userId) {
  // Hide token tooltip on token update
  pf1.tooltip?.unbind(token);
});

/**
 * HACK: Fixes unlinked token sizing not working correctly.
 * Remove when upstream issue is solved and brought live: https://github.com/foundryvtt/foundryvtt/issues/8761
 */
Hooks.on("preCreateToken", (token, initialData, options, userId) => {
  // Apply token size
  if (token.getFlag("pf1", "staticSize")) return;
  const sizeConf = PF1.tokenSizes[token.actor?.system.traits?.size];
  if (!sizeConf) return;

  // token.updateSource() doesn't work here
  initialData.width = sizeConf.w;
  initialData.height = sizeConf.h;
  initialData.texture ??= {};
  initialData.texture.scaleY = sizeConf.scale;
  initialData.texture.scaleX = sizeConf.scale;
});

Hooks.on("createItem", (item, options, userId) => {
  const actor = item.parent instanceof ActorPF ? item.parent : null;
  if (userId !== game.user.id) return;

  // Show buff if active
  if (item.type === "buff" && item.system.active === true) {
    // Call hook
    if (actor) {
      callOldNamespaceHookAll("pf1.toggleActorBuff", "pf1ToggleActorBuff", actor, item, true);
      Hooks.callAll("pf1ToggleActorBuff", actor, item, true);
    }

    // Execute script calls
    item.executeScriptCalls("toggle", { state: true });
  }
  // Simulate toggling a feature on
  if (item.type === "feat") {
    const disabled = item.system.disabled;
    if (disabled === false) {
      item.executeScriptCalls("toggle", { state: true });
    }
  }
  // Simulate equipping items
  {
    const equipped = item.system.equipped;
    if (equipped === true) {
      item.executeScriptCalls("equip", { equipped: true });
    }
  }
  // Quantity change
  {
    const quantity = item.system.quantity;
    if (typeof quantity === "number" && quantity > 0) {
      item.executeScriptCalls("changeQuantity", { quantity: { previous: 0, new: quantity } });
    }
  }
});

Hooks.on("preDeleteItem", (item, options, userId) => {
  if (!item.actor) return;
  if (options.handledChildren) return;

  const visited = new Set();

  // Remove linked children with item
  const _getChildren = (item) => {
    if (visited.has(item.id)) return [];
    visited.add(item.id);

    const result = [];
    const links = item.system.links?.children ?? [];
    for (const link of links) {
      if (visited.has(link.id)) continue;

      const child = item.actor.items.get(link.id);
      if (child) {
        result.push(child.id);
        result.push(..._getChildren(child));
      }
    }
    return result;
  };

  const children = _getChildren(item);

  if (children.length > 0) {
    const toRemove = [item.id, ...children]
      .reduce((cur, o) => {
        if (!cur.includes(o)) cur.push(o);
        return cur;
      }, [])
      .filter((o) => item.actor.items.has(o));

    item.actor.deleteEmbeddedDocuments("Item", toRemove, { handledChildren: true });
    return false;
  }
});

Hooks.on("deleteItem", async (item, options, userId) => {
  if (userId !== game.user.id) return;
  const actor = item.parent instanceof ActorPF ? item.parent : null;

  if (actor) {
    // Remove links
    const itemLinks = item.system.links;
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
    if (item.type === "buff" && item.system.active === true) {
      callOldNamespaceHookAll("pf1.toggleActorBuff", "pf1ToggleActorBuff", actor, item, false);
      Hooks.callAll("pf1ToggleActorBuff", actor, item, false);
    }
  }
});

Hooks.on("updateItem", async (item, changedData, options, userId) => {
  if (userId !== game.user.id) return;
  const actor = item.parent instanceof ActorPF ? item.parent : null;

  if (actor) {
    // Toggle buff
    const isActive = changedData.system?.active;
    if (item.type === "buff" && isActive !== undefined) {
      // Call hook
      callOldNamespaceHookAll("pf1.toggleActorBuff", "pf1ToggleActorBuff", actor, item, isActive);
      Hooks.callAll("pf1ToggleActorBuff", actor, item, isActive);
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
  if (data.type === "Item") macro = macros.createItemMacro(data, slot);
  else if (data.type === "skill") macro = macros.createSkillMacro(data.skill, data.actor, slot);
  else if (data.type === "save") macro = macros.createSaveMacro(data.altType, data.actor, slot);
  else if (["defenses", "cmb", "concentration", "cl", "bab"].includes(data.type))
    macro = macros.createMiscActorMacro(data.type, data.actor, slot, data.altType);
  else return true;

  if (macro == null || macro instanceof Promise) return false;
});

// Render TokenConfig
Hooks.on("renderTokenConfig", async (app, html) => {
  // Add vision inputs
  let token = app.object;
  // Prototype token
  if (token instanceof Actor) token = token.prototypeToken;

  const flags = token.flags?.pf1;

  // Add static size checkbox
  let newHTML = `<div class="form-group"><label>${game.i18n.localize(
    "PF1.StaticSize"
  )}</label><input type="checkbox" name="flags.pf1.staticSize" data-dtype="Boolean"`;
  if (flags?.staticSize) newHTML += " checked";
  newHTML += "/></div>";
  html.find('.tab[data-tab="appearance"] > *:nth-child(3)').after(newHTML);

  // Disable vision elements if custom vision is disabled
  const enableCustomVision = flags?.customVisionRules === true;
  if (!enableCustomVision) {
    const tabElem = html.find(`.tab[data-tab="vision"]`);
    // Disable vision mode selection
    tabElem.find("select[name='sight.visionMode']").prop("disabled", true);
    // Disable detection mode tab entirely
    const dmTab = tabElem.find(".tab[data-tab='detection']");
    dmTab.find("input,select").prop("disabled", true);
    dmTab.find("a.action-button").unbind();
  }
  // Add custom vision checkbox
  newHTML = `<div class="form-group" data-tooltip="PF1.CustomVisionRules.Description"><label>${game.i18n.localize(
    "PF1.CustomVisionRules.Label"
  )}</label><input type="checkbox" name="flags.pf1.customVisionRules" data-dtype="Boolean"`;
  if (enableCustomVision) newHTML += " checked";
  newHTML += "/></div>";
  html.find(`.tab[data-tab="vision"]`).append(newHTML);
  // Add listener for custom vision rules checkbox
  html.find(`.tab[data-tab="vision"] input[name="flags.pf1.customVisionRules"]`).on("change", async (event) => {
    await app._onSubmit(event, { preventClose: true });
    return app.render();
  });

  // Add disable low-light vision checkbox
  addLowLightVisionToTokenConfig(app, html);

  // Resize windows
  app.setPosition();
});

// Render Sidebar
Hooks.on("renderSidebarTab", (app, html) => {
  if (app instanceof Settings) {
    // Add buttons
    const chlogButton = $(`<button>${game.i18n.localize("PF1.Changelog")}</button>`);
    const helpButton = $(`<button>${game.i18n.localize("PF1.Help.Label")}</button>`);
    const tshooterButton = $(`<button>${game.i18n.localize("PF1.Troubleshooter.Button")}</button>`);
    html
      .find("#game-details")
      .after(
        $(`<h2>${game.i18n.localize("PF1.Title")}</h2>`),
        $("<div id='pf1-details'>").append(chlogButton, helpButton, tshooterButton)
      );

    chlogButton.click(() => {
      const chlog = Object.values(ui.windows).find((o) => o.id == "changelog") ?? new ChangeLogWindow();
      chlog.render(true, { focus: true });
    });
    helpButton.click(() => pf1.applications.helpBrowser.openUrl("Help/Home"));
    tshooterButton.click(() => pf1.applications.Troubleshooter.open());
  }
});

// Add compendium sidebar context options
Hooks.on("getCompendiumDirectoryPFEntryContext", (html, entryOptions) => {
  // Add option to enable & disable pack
  entryOptions.unshift(
    {
      name: game.i18n.localize("PF1.CompendiumBrowser.HidePack"),
      icon: '<i class="fas fa-low-vision"></i>',
      condition: ([li]) => {
        const pack = game.packs.get(li.dataset.pack);
        return pack.config.pf1?.disabled !== true;
      },
      callback: ([li]) => {
        const pack = game.packs.get(li.dataset.pack);
        pack.configure({ "pf1.disabled": true });
      },
    },
    {
      name: game.i18n.localize("PF1.CompendiumBrowser.ShowPack"),
      icon: '<i class="fas fa-eye"></i>',
      condition: ([li]) => {
        const pack = game.packs.get(li.dataset.pack);
        return pack.config.pf1?.disabled === true;
      },
      callback: ([li]) => {
        const pack = game.packs.get(li.dataset.pack);
        pack.configure({ "pf1.disabled": false });
      },
    }
  );
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

Hooks.on("controlToken", () => {
  // Refresh lighting to (un)apply low-light vision parameters to them
  canvas.perception.update(
    {
      initializeLighting: true,
    },
    true
  );
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
