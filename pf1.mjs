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
import { tinyMCEInit } from "./module/mce/mce.mjs";
import { measureDistances, getConditions } from "./module/utils/canvas.mjs";
import { getFirstActiveGM, moduleToObject, setDefaultSceneScaling } from "./module/utils/lib.mjs";
import { initializeSocket } from "./module/socket.mjs";
import { SemanticVersion } from "./module/utils/semver.mjs";
import * as chat from "./module/utils/chat.mjs";
import * as macros from "./module/documents/macros.mjs";
import { initializeModules } from "./module/modules.mjs";
import { ActorPFProxy } from "@actor/actor-proxy.mjs";
import { ItemPFProxy } from "@item/item-proxy.mjs";

// New API
import * as PF1 from "./module/config.mjs";
import * as PF1CONST from "./module/const.mjs";
import * as applications from "./module/applications/_module.mjs";
import * as documents from "./module/documents/_module.mjs";
import * as actionUse from "./module/action-use/_module.mjs";
import * as _canvas from "./module/canvas/_module.mjs";
import * as dice from "./module/dice/_module.mjs";
import * as components from "./module/components/_module.mjs";
import * as utils from "./module/utils/_module.mjs";
import * as registry from "./module/registry/_module.mjs";
import * as migrations from "./module/migration.mjs";

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
  const: PF1CONST,
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

  // Global exports
  globalThis.RollPF = dice.RollPF;

  // Record Configuration Values
  CONFIG.PF1 = pf1.config;

  // Canvas object classes and configuration
  CONFIG.Canvas.layers.templates.layerClass = _canvas.TemplateLayerPF;
  CONFIG.MeasuredTemplate.objectClass = _canvas.MeasuredTemplatePF;
  CONFIG.MeasuredTemplate.defaults.originalAngle = CONFIG.MeasuredTemplate.defaults.angle;
  CONFIG.MeasuredTemplate.defaults.angle = 90; // PF1 uses 90 degree angles
  CONFIG.Token.objectClass = _canvas.TokenPF;

  // Document classes
  CONFIG.Actor.documentClass = ActorPFProxy;
  CONFIG.Actor.documentClasses = {
    character: documents.actor.ActorCharacterPF,
    npc: documents.actor.ActorNPCPF,
    haunt: documents.actor.ActorHauntPF,
    trap: documents.actor.ActorTrapPF,
    vehicle: documents.actor.ActorVehiclePF,
    basic: documents.actor.BasicActorPF,
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
  };

  CONFIG.Token.documentClass = documents.TokenDocumentPF;
  CONFIG.ActiveEffect.documentClass = documents.ActiveEffectPF;
  CONFIG.ActiveEffect.legacyTransferral = false; // TODO: Remove once legacy transferral is no longer default.
  CONFIG.Combat.documentClass = documents.CombatPF;
  CONFIG.Combatant.documentClass = documents.CombatantPF;
  CONFIG.ChatMessage.documentClass = documents.ChatMessagePF;

  // UI classes
  CONFIG.ui.items = applications.ItemDirectoryPF;

  // Dice config
  CONFIG.Dice.rolls.unshift(dice.RollPF);
  CONFIG.Dice.termTypes.SizeRollTerm = dice.terms.SizeRollTerm;
  CONFIG.Dice.rolls.push(dice.D20RollPF);
  CONFIG.Dice.rolls.push(dice.DamageRoll);
  Object.defineProperties(CONFIG.Dice, {
    RollPF: {
      get() {
        foundry.utils.logCompatibilityWarning(
          "CONFIG.Dice.RollPF is deprecated in favor of RollPF global and pf1.dice.RollPF",
          { since: "PF1 vNEXT", until: "PF1 vNEXT+1" }
        );
        return pf1.dice.RollPF;
      },
    },
  });
  Object.defineProperties(CONFIG.Dice.rolls, {
    DamageRoll: {
      get() {
        foundry.utils.logCompatibilityWarning(
          "CONFIG.Dice.rolls.DamageRoll is deprecated in favor of pf1.dice.DamageRoll",
          { since: "PF1 vNEXT", until: "PF1 vNEXT+1" }
        );
        return pf1.dice.DamageRoll;
      },
    },
    D20RollPF: {
      get() {
        foundry.utils.logCompatibilityWarning(
          "CONFIG.Dice.rolls.D20RollPF is deprecated in favor of pf1.dice.D20RollPF",
          { since: "PF1 vNEXT", until: "PF1 vNEXT+1" }
        );
        return pf1.dice.D20RollPF;
      },
    },
  });

  Object.defineProperty(pf1.config, "itemTypes", {
    get() {
      foundry.utils.logCompatibilityWarning("pf1.config.itemTypes is deprecated in favor of CONFIG.Item.typeLabels", {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      });

      return Object.fromEntries(
        Object.entries(CONFIG.Item.typeLabels).map(([key, label]) => [key, game.i18n.localize(label)])
      );
    },
  });

  CONFIG.time.roundTime = 6;

  // Register System Settings
  documents.settings.registerSystemSettings();
  documents.settings.registerClientSettings();
  setDefaultSceneScaling();

  //Calculate conditions for world
  CONFIG.statusEffects = getConditions();

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
  Actors.registerSheet("pf1", applications.actor.ActorSheetPFBasic, {
    label: "PF1.Sheet.Basic",
    types: ["basic"],
    makeDefault: true,
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("pf1", applications.item.ItemSheetPF, {
    label: "PF1.Sheet.Item",
    types: ["class", "feat", "spell", "consumable", "equipment", "loot", "weapon", "buff", "attack", "race"],
    makeDefault: true,
  });
  Items.registerSheet("pf1", applications.item.ItemSheetPF_Container, {
    label: "PF1.Sheet.Container",
    types: ["container"],
    makeDefault: true,
  });

  // Register detection modes
  for (const mode of Object.values(pf1.canvas.detectionModes)) {
    CONFIG.Canvas.detectionModes[mode.ID] = new mode({
      id: mode.ID,
      label: mode.LABEL,
      type: mode.DETECTION_TYPE || DetectionMode.DETECTION_TYPES.SIGHT,
    });
  }

  // Register vision modes
  CONFIG.Canvas.visionModes.darkvision = pf1.canvas.visionModes.darkvision;

  // Initialize socket listener
  initializeSocket();

  // Initialize module integrations
  initializeModules();

  // Initialize registries with initial/built-in data
  const registries = /** @type {const} */ ([
    ["damageTypes", registry.DamageTypes],
    ["scriptCalls", registry.ScriptCalls],
    ["sources", registry.Sources],
  ]);
  for (const [registryName, registryClass] of registries) {
    pf1.registry[registryName] = new registryClass();
  }

  // Define getter for config properties moved into registries
  Object.defineProperty(pf1.config, "damageTypes", {
    get: () => {
      foundry.utils.logCompatibilityWarning(
        "Damage types have been moved into the DamageTypes registry. " +
          "Use pf1.registry.damageTypes.getLabels() for the old format, or access the collection for full damage type data.",
        { since: "PF1 v9", until: "PF1 v10" }
      );
      return pf1.registry.damageTypes.getLabels();
    },
  });

  // Diagonal ruleset implementation
  SquareGrid.prototype.measureDistances = measureDistances;

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
    "timePeriods",
    "timePeriodsShort",
    "savingThrows",
    "ac",
    "featTypes",
    "featTypesPlurals",
    "traitTypes",
    "conditions",
    "lootTypes",
    "flyManeuverabilities",
    "abilityTypes",
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
    "vehicles",
  ];

  // Config (sub-)objects to be sorted
  const toSort = [
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
    pf1.config[o] = doLocalize(pf1.config[o], o);
  }

  // Localize buff targets
  const localizeLabels = ["buffTargets", "buffTargetCategories", "contextNoteTargets", "contextNoteCategories"];
  for (const l of localizeLabels) {
    for (const [k, v] of Object.entries(pf1.config[l])) {
      pf1.config[l][k].label = game.i18n.localize(v.label);
    }
  }
});

/**
 * This function runs after game data has been requested and loaded from the servers, so documents exist
 */
Hooks.once("setup", () => {
  // Prepare registry data
  for (const registry of Object.values(pf1.registry)) {
    if (registry instanceof pf1.registry.Registry) registry.setup();
  }

  // TinyMCE variables and commands
  tinyMCEInit();

  // Register controls
  documents.controls.registerSystemControls();

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
  if (!ttconf.disable && !ttwconf.disable) pf1.applications.TooltipPF.toggle(true);

  window.addEventListener("resize", () => {
    pf1.tooltip?.setPosition();
  });

  // Migrate data
  const NEEDS_MIGRATION_VERSION = "9.4";
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
    await pf1.migrations.migrateWorld({ dialog: {} });
  }

  if (!game.user.isGM && game.settings.get("pf1", "migrating")) {
    ui.notifications.warn("PF1.Migration.InProgress", { localize: true });
  }

  // Migrate system settings
  await documents.settings.migrateSystemSettings();

  // Populate `pf1.applications.compendiums`
  pf1.applications.compendiumBrowser.CompendiumBrowser.initializeBrowsers();

  // Show changelog
  if (!game.settings.get("pf1", "dontShowChangelog")) {
    const v = game.settings.get("pf1", "changelogVersion") || "0.0.1";
    const changelogVersion = SemanticVersion.fromString(v);
    const curVersion = SemanticVersion.fromString(game.system.version);

    if (curVersion.isHigherThan(changelogVersion)) {
      const app = new pf1.applications.ChangeLogWindow(changelogVersion);
      app.render(true, { focus: true });
      game.settings.set("pf1", "changelogVersion", curVersion.toString());
    }
  }

  // Create permanent warning if script changes are allowed
  if (game.settings.get("pf1", "allowScriptChanges")) {
    ui.notifications.warn("SETTINGS.pf1AllowScriptChangesD", { localize: true, permanent: true });
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
    chat.hideRollInfo(cm, jq, options);

    // Hide GM sensitive info
    chat.hideGMSensitiveInfo(cm, jq, options);

    // Hide non-visible targets for players
    if (!game.user.isGM) chat.hideInvisibleTargets(cm, jq);

    // Create target callbacks
    chat.addTargetCallbacks(cm, jq);

    // Alter target defense options
    chat.alterTargetDefense(cm, jq);

    // Optionally collapse the content
    if (game.settings.get("pf1", "autoCollapseItemCards")) jq.find(".card-content").hide();

    // Optionally hide chat buttons
    if (game.settings.get("pf1", "hideChatButtons")) jq.find(".card-buttons").hide();

    // Apply accessibility settings to chat message
    chat.applyAccessibilitySettings(cm, jq, options, game.settings.get("pf1", "accessibilityConfig"));

    // Alter ammo recovery options
    chat.alterAmmoRecovery(cm, jq);

    // Handle chat tooltips
    jq.find(".tooltip").on("mousemove", (ev) => handleChatTooltips(ev));
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

Hooks.on("renderAmbientLightConfig", (app, html) => {
  _canvas.lowLightVision.addLowLightVisionToLightConfig(app, html);
});

Hooks.on("renderTokenHUD", (app, html, data) => {
  _canvas.TokenQuickActions.addQuickActions(app, html, data);
});

// Hide token tooltip on token update or deletion
Hooks.on("deleteToken", (token) => pf1.tooltip?.unbind(token));
Hooks.on("updateToken", (token) => pf1.tooltip?.unbind(token));

Hooks.on("chatMessage", (log, message, chatData) => {
  const result = documents.customRolls(message, chatData.speaker);
  return !result;
});

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

// Refresh skip state (alleviates sticky modifier issue #1572)
window.addEventListener("focus", () => (pf1.skipConfirmPrompt = false), { passive: true });
