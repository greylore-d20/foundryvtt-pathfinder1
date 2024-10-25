/**
 * The core API provided by the system, available via the global `pf1`.
 *
 * @module
 */

// Imports for side effects
import "./less/pf1.less";
import "./module/hmr.mjs";
import "./module/patch-core.mjs";
import "module/compendium-directory.mjs";
import "./module/chatlog.mjs";

// Import Modules
import { moduleToObject, setDefaultSceneScaling } from "./module/utils/lib.mjs";
import { initializeSocket } from "./module/socket.mjs";
import { SemanticVersion } from "./module/utils/semver.mjs";
import * as macros from "./module/documents/macros.mjs";
import * as chatUtils from "./module/utils/chat.mjs";
import { initializeModuleIntegration } from "./module/modules.mjs";
import { ActorPFProxy } from "@actor/actor-proxy.mjs";
import { ItemPFProxy } from "@item/item-proxy.mjs";

// New API
import * as PF1 from "./module/config.mjs";
import * as PF1CONST from "./module/const.mjs";
import * as applications from "./module/applications/_module.mjs";
import * as documents from "./module/documents/_module.mjs";
import * as models from "./module/models/_module.mjs";
import * as actionUse from "./module/action-use/_module.mjs";
import * as chat from "./module/chat/_module.mjs";
import * as _canvas from "./module/canvas/_module.mjs";
import * as dice from "./module/dice/_module.mjs";
import * as components from "./module/components/_module.mjs";
import * as utils from "./module/utils/_module.mjs";
import * as registry from "./module/registry/_module.mjs";
import * as migrations from "./module/migration.mjs";
import * as rollFunctions from "./module/utils/roll-functions.mjs";

// ESM exports, to be kept in sync with globalThis.pf1
export {
  actionUse,
  applications,
  _canvas as canvas,
  components,
  PF1 as config,
  PF1CONST as const,
  dice,
  documents,
  models,
  migrations,
  registry,
  utils,
  chat,
};

globalThis.pf1 = moduleToObject({
  actionUse,
  applications,
  canvas: _canvas,
  components,
  config: PF1,
  const: PF1CONST,
  dice,
  documents,
  models,
  migrations,
  registry,
  utils,
  chat,
  // Initialize skip confirm prompt value
  skipConfirmPrompt: false,
});

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

  // Temp store
  Object.defineProperty(pf1, "_temp", {
    value: {},
    enumerable: false,
    writable: false,
  });

  // Global exports
  globalThis.RollPF = dice.RollPF;

  // Record Configuration Values
  CONFIG.PF1 = pf1.config;

  // Canvas
  CONFIG.Canvas.layers.templates.layerClass = _canvas.TemplateLayerPF;

  // Measured Template
  CONFIG.MeasuredTemplate.objectClass = _canvas.MeasuredTemplatePF;
  CONFIG.MeasuredTemplate.defaults.originalAngle = CONFIG.MeasuredTemplate.defaults.angle;
  CONFIG.MeasuredTemplate.defaults.angle = 90; // PF1 uses 90 degree angles

  // Token
  CONFIG.Token.objectClass = _canvas.TokenPF;
  CONFIG.Token.hudClass = _canvas.TokenHUDPF;
  CONFIG.Token.documentClass = documents.TokenDocumentPF;

  // Document classes
  CONFIG.Actor.documentClass = ActorPFProxy;
  CONFIG.Actor.documentClasses = {
    character: documents.actor.ActorCharacterPF,
    npc: documents.actor.ActorNPCPF,
    haunt: documents.actor.ActorHauntPF,
    trap: documents.actor.ActorTrapPF,
    vehicle: documents.actor.ActorVehiclePF,
  };
  CONFIG.Item.documentClass = ItemPFProxy;
  CONFIG.Item.documentClasses = {
    attack: documents.item.ItemAttackPF,
    buff: documents.item.ItemBuffPF,
    class: documents.item.ItemClassPF,
    consumable: documents.item.ItemConsumablePF,
    container: documents.item.ItemContainerPF,
    equipment: documents.item.ItemEquipmentPF,
    feat: documents.item.ItemFeatPF,
    loot: documents.item.ItemLootPF,
    race: documents.item.ItemRacePF,
    spell: documents.item.ItemSpellPF,
    weapon: documents.item.ItemWeaponPF,
    implant: documents.item.ItemImplantPF,
  };

  // Active Effects
  CONFIG.ActiveEffect.documentClass = documents.ActiveEffectPF;
  CONFIG.ActiveEffect.legacyTransferral = false; // TODO: Remove once legacy transferral is no longer default.
  CONFIG.ActiveEffect.dataModels.base = models.ae.AEBase;
  CONFIG.ActiveEffect.dataModels.buff = models.ae.AEBuff;

  // Combat
  CONFIG.Combat.documentClass = documents.CombatPF;
  CONFIG.Combatant.documentClass = documents.CombatantPF;

  // Chat
  CONFIG.ChatMessage.documentClass = documents.ChatMessagePF;

  // UI classes
  CONFIG.ui.items = applications.ItemDirectoryPF;

  // Dice config
  CONFIG.Dice.rolls.unshift(dice.RollPF);

  CONFIG.Dice.rolls.push(dice.D20RollPF);
  CONFIG.Dice.rolls.push(dice.DamageRoll);

  CONFIG.Dice.termTypes.FunctionTerm = pf1.dice.terms.FunctionTermPF;

  // Roll functions
  for (const [key, fn] of Object.entries(pf1.utils.roll.functions)) {
    CONFIG.Dice.functions[key] = fn;
  }

  // Combat time progression
  CONFIG.time.roundTime = 6;

  // Low-Light Vision mixin
  CONFIG.AmbientLight.objectClass = _canvas.lowLightVision.LLVMixin(CONFIG.AmbientLight.objectClass);
  CONFIG.Token.objectClass = _canvas.lowLightVision.LLVMixin(CONFIG.Token.objectClass);

  // Register System Settings
  documents.settings.registerSystemSettings();
  documents.settings.registerClientSettings();
  setDefaultSceneScaling();

  // Preload Handlebars Templates
  utils.handlebars.preloadHandlebarsTemplates();
  utils.handlebars.registerHandlebarsHelpers();

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("pf1", applications.actor.ActorSheetPFCharacter, {
    label: "PF1.Sheet.PC",
    types: ["character"],
    makeDefault: true,
  });
  Actors.registerSheet("pf1", applications.actor.ActorSheetPFNPC, {
    label: "PF1.Sheet.NPC",
    types: ["npc"],
    makeDefault: true,
  });
  Actors.registerSheet("pf1", applications.actor.ActorSheetPFNPCLite, {
    label: "PF1.Sheet.NPCLite",
    types: ["npc"],
    makeDefault: false,
  });
  Actors.registerSheet("pf1", applications.actor.ActorSheetPFNPCLoot, {
    label: "PF1.Sheet.NPCLoot",
    types: ["npc"],
    makeDefault: false,
  });
  Actors.registerSheet("pf1", applications.actor.ActorSheetPFHaunt, {
    label: "PF1.Sheet.Haunt",
    types: ["haunt"],
    makeDefault: true,
  });
  Actors.registerSheet("pf1", applications.actor.ActorSheetPFTrap, {
    label: "PF1.Sheet.Trap",
    types: ["trap"],
    makeDefault: true,
  });
  Actors.registerSheet("pf1", applications.actor.ActorSheetPFVehicle, {
    label: "PF1.Sheet.Vehicle",
    types: ["vehicle"],
    makeDefault: true,
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("pf1", applications.item.ItemSheetPF, {
    label: "PF1.Sheet.Item",
    types: ["class", "feat", "spell", "consumable", "equipment", "loot", "weapon", "buff", "attack", "race", "implant"],
    makeDefault: true,
  });
  Items.registerSheet("pf1", applications.item.ItemSheetPF_Container, {
    label: "PF1.Sheet.Container",
    types: ["container"],
    makeDefault: true,
  });

  DocumentSheetConfig.registerSheet(JournalEntryPage, "pf1", applications.journal.JournalTextPageSheetPF1, {
    types: ["text"],
    makeDefault: false,
    label: "PF1.Sheet.TextPage",
  });

  // Register detection modes
  for (const mode of Object.values(pf1.canvas.detectionModes)) {
    CONFIG.Canvas.detectionModes[mode.ID] = new mode({
      id: mode.ID,
      label: mode.LABEL,
      type: mode.DETECTION_TYPE ?? DetectionMode.DETECTION_TYPES.SIGHT,
    });
  }

  // Register vision modes
  CONFIG.Canvas.visionModes.darkvision = pf1.canvas.visionModes.darkvision;

  // Initialize socket listener
  initializeSocket();

  // Initialize module integrations
  initializeModuleIntegration();

  // Initialize registries with initial/built-in data
  const registries = /** @type {const} */ ([
    ["damageTypes", registry.DamageTypes],
    ["materials", registry.Materials],
    ["scriptCalls", registry.ScriptCalls],
    ["conditions", registry.Conditions],
    ["sources", registry.Sources],
  ]);

  for (const [registryName, registryClass] of registries) {
    pf1.registry[registryName] = new registryClass();
  }

  Object.defineProperty(pf1.documents, "customRolls", {
    value: function (message, speaker, rollData) {
      foundry.utils.logCompatibilityWarning(
        "pf1.documents.customRolls() is deprecated in favor of pf1.chat.command()",
        {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        }
      );

      const re = /^\/(?<command>h|heal|d|damage)\s+(?<formula>.*?)(\s*#\s*(?<comment>.*))?$/i.exec(message);
      if (!re) throw new Error(`Failed to parse message: ${message}`);

      const { command, formula, comment } = re.groups;
      return pf1.chat.command(command, formula, comment, { speaker, rollData });
    },
  });

  Object.defineProperty(pf1.registry, "materialTypes", {
    get() {
      foundry.utils.logCompatibilityWarning("pf1.registry.materialTypes has been moved to pf1.registry.materials.", {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      });
      return pf1.registry.materials;
    },
  });

  //Calculate conditions for world
  CONFIG.statusEffects = pf1.utils.init.getConditions();

  // Register controls
  documents.controls.registerSystemControls();

  // Call post-init hook
  Hooks.callAll("pf1PostInit");
});

// Load Quench test in development environment
if (import.meta.env.DEV) {
  await import("./module/test/index.mjs");
}

/* -------------------------------------------- */
/*  Foundry VTT Setup                           */
/* -------------------------------------------- */

// Pre-translation passes
Hooks.once("i18nInit", function () {
  // Localize pf1.config objects once up-front
  const toLocalize = [
    "abilities",
    "abilitiesShort",
    "alignments",
    "alignmentsShort",
    "currencies",
    "distanceUnits",
    "itemActionTypes",
    "senses",
    "skills",
    "timePeriods",
    "timePeriodsShort",
    "durationEndEvents",
    "savingThrows",
    "ac",
    "featTypes",
    "featTypesPlurals",
    "traitTypes",
    "racialTraitCategories",
    "raceTypes",
    "conditionTypes",
    "lootTypes",
    "flyManeuverabilities",
    "favouredClassBonuses",
    "abilityTypes",
    "weaponGroups",
    "weaponTypes",
    "weaponProperties",
    "spellComponents",
    "spellDescriptors",
    "spellSchools",
    "spellSubschools",
    "spellLevels",
    "spellcasting",
    "armorProficiencies",
    "weaponProficiencies",
    "actorSizes",
    "abilityActivationTypes",
    "abilityActivationTypesPlurals",
    "limitedUsePeriods",
    "equipmentTypes",
    "equipmentSlots",
    "implantSlots",
    "implantTypes",
    "consumableTypes",
    "attackTypes",
    "buffTypes",
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
    "bonusTypes",
    "abilityActivationTypes_unchained",
    "abilityActivationTypesPlurals_unchained",
    "actorStatures",
    "ammoTypes",
    "damageResistances",
    "vehicles",
    "woundThresholdConditions",
  ];

  // Localize pf1.const objects
  const toLocalizeConst = ["messageVisibility"];

  // Config (sub-)objects to be sorted
  const toSort = [
    "bonusTypes",
    "skills",
    "traitTypes",
    "racialTraitCategories",
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
    const localized = Object.entries(obj).reduce((arr, [key, value]) => {
      if (typeof value === "string") arr.push([key, game.i18n.localize(value)]);
      else if (typeof value === "object") arr.push([key, doLocalize(value, `${cat}.${key}`)]);
      return arr;
    }, []);

    if (toSort.includes(cat)) {
      // Sort simple strings, fall back to sorting by label for objects/categories
      localized.sort(([akey, aval], [bkey, bval]) => {
        // Move misc to bottom of every list
        if (akey === "misc") return 1;
        else if (bkey === "misc") return -1;

        // Regular sorting of localized strings
        const localA = typeof aval === "string" ? aval : aval._label;
        const localB = typeof bval === "string" ? bval : bval._label;
        return localA.localeCompare(localB);
      });
    }

    // Get the localized and sorted object out of tuple
    return localized.reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
  };

  const doLocalizePaths = (obj, paths = []) => {
    for (const path of paths) {
      const value = foundry.utils.getProperty(obj, path);
      if (value) {
        foundry.utils.setProperty(obj, path, game.i18n.localize(value));
      }
    }
  };

  const doLocalizeKeys = (obj, keys = []) => {
    for (const path of Object.keys(foundry.utils.flattenObject(obj))) {
      const key = path.split(".").at(-1);
      if (keys.includes(key)) {
        const value = foundry.utils.getProperty(obj, path);
        if (value) {
          foundry.utils.setProperty(obj, path, game.i18n.localize(value));
        }
      }
    }
  };

  // Localize and sort CONFIG objects
  for (const o of toLocalize) {
    pf1.config[o] = doLocalize(pf1.config[o], o);
  }

  for (const o of toLocalizeConst) {
    pf1.const[o] = doLocalize(pf1.const[o], o);
  }

  // Localize buff targets
  const localizeLabels = [
    "buffTargets",
    "buffTargetCategories",
    "contextNoteTargets",
    "contextNoteCategories",
    "ageCategories",
  ];
  for (const l of localizeLabels) {
    for (const [k, v] of Object.entries(pf1.config[l])) {
      pf1.config[l][k].label = game.i18n.localize(v.label);
    }
  }

  // Extra attack structure
  doLocalizeKeys(pf1.config.extraAttacks, ["label", "flavor"]);

  // Level-up data
  doLocalizePaths(pf1.config.levelAbilityScoreFeature, ["name", "system.description.value"]);

  // Point buy data
  doLocalizeKeys(pf1.config.pointBuy, ["label"]);

  // Caster type labels
  doLocalizeKeys(pf1.config.caster.type, ["label"]);
  doLocalizeKeys(pf1.config.caster.progression, ["label", "hint"]);

  // Localize registry data
  for (const registry of Object.values(pf1.registry)) {
    if (registry instanceof pf1.registry.Registry) registry.localize();
  }
});

/**
 * This function runs after game data has been requested and loaded from the servers, so documents exist
 */
Hooks.once("setup", () => {
  Hooks.callAll("pf1PostSetup");
});

/* -------------------------------------------- */

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", async function () {
  // Migrate data
  const NEEDS_MIGRATION_VERSION = "10.5";
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

  if (needMigration) {
    const options = {};
    // Omit dialog for new worlds with presumably nothing to migrate
    if (PREVIOUS_MIGRATION_VERSION === "0.0.0") options.dialog = false;

    await pf1.migrations.migrateWorld(options);
  }

  // Inform users who aren't running migration
  if (!game.user.isGM && game.settings.get("pf1", "migrating")) {
    ui.notifications.warn("PF1.Migration.InProgress", { localize: true });
  }

  // Migrate system settings
  await documents.settings.migrateSystemSettings();

  // Populate `pf1.applications.compendiums`
  pf1.applications.compendiumBrowser.CompendiumBrowser.initializeBrowsers();

  // Show changelog
  if (!game.settings.get("pf1", "dontShowChangelog")) {
    const v = game.settings.get("pf1", "changelogVersion");
    const changelogVersion = SemanticVersion.fromString(v);
    const curVersion = SemanticVersion.fromString(game.system.version);

    if (curVersion.isHigherThan(changelogVersion)) {
      const app = new pf1.applications.ChangeLogWindow(true);
      app.render(true, { focus: true });
      game.settings.set("pf1", "changelogVersion", curVersion.toString());
    }
  }

  Hooks.callAll("pf1PostReady");
});

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

Hooks.on(
  "renderChatMessage",
  /**
   * @param {ChatMessage} cm - Chat message instance
   * @param {JQuery<HTMLElement>} jq - JQuery instance
   * @param {object} options - Render options
   */
  (cm, jq, options) => {
    // Hide roll info
    chatUtils.hideRollInfo(cm, jq, options);

    // Hide GM sensitive info
    chatUtils.hideGMSensitiveInfo(cm, jq, options);

    // Hide non-visible targets for players
    if (!game.user.isGM) chatUtils.hideInvisibleTargets(cm, jq[0]);

    // Create target callbacks
    chatUtils.addTargetCallbacks(cm, jq);

    // Alter target defense options
    chatUtils.alterTargetDefense(cm, jq);

    // Optionally collapse the content
    if (game.settings.get("pf1", "autoCollapseItemCards")) jq.find(".card-content").hide();

    // Optionally hide chat buttons
    if (game.settings.get("pf1", "hideChatButtons")) jq.find(".card-buttons").hide();

    // Alter ammo recovery options
    chatUtils.alterAmmoRecovery(cm, jq);
  }
);

Hooks.on("renderChatPopout", (app, html, data) => {
  // Optionally collapse the content
  if (game.settings.get("pf1", "autoCollapseItemCards")) html.find(".card-content").hide();

  // Optionally hide chat buttons
  if (game.settings.get("pf1", "hideChatButtons")) html.find(".card-buttons").hide();
});

Hooks.on("renderChatLog", (_, html) => documents.item.ItemPF.chatListeners(html));
Hooks.on("renderChatLog", (_, html) => documents.actor.ActorPF.chatListeners(html));
Hooks.on("renderChatLog", (_, html) => _canvas.attackReach.addReachListeners(html));

Hooks.on("renderChatPopout", (_, html) => documents.item.ItemPF.chatListeners(html));
Hooks.on("renderChatPopout", (_, html) => documents.actor.ActorPF.chatListeners(html));

Hooks.on("renderActorDirectory", (app, html, data) => {
  html.find("li.actor").each((i, li) => {
    li.addEventListener(
      "drop",
      applications.CurrencyTransfer._directoryDrop.bind(undefined, li.getAttribute("data-document-id"))
    );
  });
});

Hooks.on("renderItemDirectory", (app, html, data) => {
  html.find("li.item").each((i, li) => {
    li.addEventListener(
      "drop",
      applications.CurrencyTransfer._directoryDrop.bind(undefined, li.getAttribute("data-document-id"))
    );
  });
});

Hooks.on("dropActorSheetData", (act, sheet, data) => {
  if (data.type === "Currency") sheet._onDropCurrency(event, data);
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

// Delay hotbarDrop handler registration to allow modules to override it.
Hooks.once("ready", () => {
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    let macro;
    const { type, uuid } = data;
    switch (type) {
      case "Item":
        macro = macros.createItemMacro(uuid, slot);
        break;
      case "action":
        macro = macros.createActionMacro(data.actionId, uuid, slot);
        break;
      case "skill":
        macro = macros.createSkillMacro(data.skill, uuid, slot);
        break;
      case "save":
        macro = macros.createSaveMacro(data.save, uuid, slot);
        break;
      case "defenses":
      case "cmb":
      case "concentration":
      case "cl":
      case "attack":
      case "abilityScore":
      case "initiative":
      case "bab":
        macro = macros.createMiscActorMacro(type, uuid, slot, data);
        break;
      default:
        return true;
    }

    if (macro == null || macro instanceof Promise) return false;
  });
});

// Render TokenConfig
Hooks.on(
  "renderTokenConfig",
  /**
   * @param {TokenConfig} app - Config application
   * @param {JQuery<HTMLElement>} html - HTML element
   */
  async (app, html) => {
    // Add vision inputs
    let token = app.object;
    // Prototype token
    if (token instanceof Actor) token = token.prototypeToken;

    const flags = token.flags?.pf1 ?? {};

    // Add static size checkbox
    const sizingTemplateData = { flags };
    const sizeContent = await renderTemplate(
      "systems/pf1/templates/foundry/token/token-sizing.hbs",
      sizingTemplateData
    );

    const systemVision = game.settings.get("pf1", "systemVision");

    html.find('.tab[data-tab="appearance"] > *:nth-child(3)').after(sizeContent);

    const visionTab = html[0].querySelector(`.tab[data-tab="vision"]`);

    // Disable vision elements if custom vision is disabled
    const enableCustomVision = flags.customVisionRules === true || !systemVision;

    let addDetectionModeButtonListener;
    const toggleCustomVision = (enabled) => {
      // Disable vision mode selection
      visionTab.querySelector("select[name='sight.visionMode']").disabled = !enabled;

      // Disable detection mode tab
      const dmTab = visionTab.querySelector(".tab[data-tab='detection']");
      for (const el of dmTab.querySelectorAll("input,select")) {
        if (el.name === "flags.pf1.customVisionRules") continue;
        el.disabled = !enabled;
      }

      // Disable detection mode tab buttons via CSS
      dmTab.classList.toggle("disabled", !enabled);
    };

    if (!enableCustomVision) toggleCustomVision(enableCustomVision);

    const visionContent = await renderTemplate("systems/pf1/templates/foundry/token/custom-vision.hbs", {
      enabled: enableCustomVision || !systemVision,
      noSystemVision: !systemVision,
    });

    $(visionTab).append(visionContent);

    // Add listener for custom vision rules checkbox
    // Soft toggle to work nicer with Foundry's preview behaviour
    visionTab.querySelector(`input[name="flags.pf1.customVisionRules"]`).addEventListener("change", async (event) => {
      toggleCustomVision(event.target.checked);
    });

    // Resize windows
    app.setPosition();
  }
);

// Render Sidebar
Hooks.on("renderSidebarTab", (app, html) => {
  if (app instanceof Settings) {
    // Add buttons
    const chlogButton = $(`<button>${game.i18n.localize("PF1.Application.Changelog.Title")}</button>`);
    const helpButton = $(`<button>${game.i18n.localize("PF1.Help.Label")}</button>`);
    const tshooterButton = $(`<button>${game.i18n.localize("PF1.Troubleshooter.Button")}</button>`);
    html
      .find("#game-details")
      .after(
        $(`<h2>${game.i18n.localize("PF1.Title")}</h2>`),
        $("<div id='pf1-details'>").append(chlogButton, helpButton, tshooterButton)
      );

    chlogButton.click(() => {
      const chlog = Object.values(ui.windows).find((o) => o.id == "changelog") ?? new applications.ChangeLogWindow();
      chlog.render(true, { focus: true });
    });
    helpButton.click(() => pf1.applications.helpBrowser.openUrl("Help/Home"));
    tshooterButton.click(() => pf1.applications.Troubleshooter.open());
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
    if (game.users.activeGM?.isSelf) {
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

// Refresh skip state (alleviates sticky modifier issue #1572)
window.addEventListener("focus", () => (pf1.skipConfirmPrompt = false), { passive: true });
