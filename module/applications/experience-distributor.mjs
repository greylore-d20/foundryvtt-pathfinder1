import { DragDropApplicationMixin } from "@app/mixins/drag-drop.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 *
 * @augments{DragDropApplicationMixin<HandlebarsApplicationMixin<ApplicationV2>>}
 */
export class ExperienceDistributor extends DragDropApplicationMixin(HandlebarsApplicationMixin(ApplicationV2)) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: ExperienceDistributor._giveAll,
      submitOnChange: false,
      submitOnClose: false,
      closeOnSubmit: false,
    },
    classes: ["pf1-v2", "experience-distributor"],
    window: {
      title: "PF1.Application.XPDistributor.Title",
      minimizable: true,
      resizable: true,
    },
    actions: {
      cancel: ExperienceDistributor._cancel,
      split: ExperienceDistributor._split,
      give: ExperienceDistributor._giveAll,
    },
    dragDrop: [{ dragSelector: null, dropSelector: "form" }],
    position: {
      width: 450,
      height: 690,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/experience-distributor.hbs",
      scrollable: [".selectors"],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  /**
   * @type {number} - Bonus XP granted
   */
  _bonusXP = 0;

  /**
   * @type {ExperienceDistributorActor[]} - Special actor data array
   */
  _actors = [];

  constructor(options) {
    let actors = [];
    if (options?.actors) {
      foundry.utils.logCompatibilityWarning(
        "ExperienceDistributor first parameter is no longer directly actor array. Please provide options object with actors property instead.",
        {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        }
      );
      actors = options.actors ?? [];
      delete options.actors;
    }

    super(options);

    this._actors = actors.map((o) => this.constructor.getActorData(o)).filter((o) => !!o);
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    return {
      // Add combatants
      actors: {
        characters: this.characters,
        npcs: this.npcs,
      },

      // Add labels
      xp: {
        total: this.totalExperience.toLocaleString(),
        split: this.splitExperience.toLocaleString(),
      },

      bonusXP: this._bonusXP,
      buttons: [
        {
          type: "button",
          label: "PF1.Application.XPDistributor.SplitEvenly",
          icon: "fas fa-people-arrows",
          action: "split",
        },
        { type: "button", label: "PF1.Application.XPDistributor.GiveToAll", icon: "fas fa-star", action: "give" },
        { type: "button", label: "PF1.Cancel", icon: "fas fa-ban", action: "cancel" },
      ],
    };
  }

  /* -------------------------------------------- */

  /**
   * Get PC actors
   *
   * @type {ExperienceDistributorActor[]}
   */
  get characters() {
    return this._actors.filter((o) => !o.isNPC);
  }

  /* -------------------------------------------- */

  /**
   * Get NPC actors
   *
   * @type {ExperienceDistributorActor[]}
   */
  get npcs() {
    return this._actors.filter((o) => o.isNPC);
  }

  /* -------------------------------------------- */

  /**
   * Handle Drop Event
   *
   * @param {DragEvent} event - The originating DragEvent
   * @protected
   * @async
   * @override
   */
  async _onDrop(event) {
    event.preventDefault();
    const data = TextEditor.getDragEventData(event);

    if (data.type !== "Actor") return;

    // Add actor
    const actor = await pf1.documents.actor.ActorPF.fromDropData(data);

    // Prevent duplicate characters (not NPCs)
    if (actor.type !== "character" || this._actors.find((o) => o.actor === actor) == null) {
      // Add actor to list
      const actorData = this.constructor.getActorData(actor);
      actorData.selected = true;
      this._actors.push(actorData);

      this.render({ parts: ["form"] });
    }
  }

  /* -------------------------------------------- */

  /**
   * The event handler for changes to form input elements
   *
   * @internal
   * @param {ApplicationFormConfiguration} formConfig   The configuration of the form being changed
   * @param {Event} event                               The triggering event
   * @returns {void}
   */
  _onChangeForm(formConfig, event) {
    event.preventDefault();

    const el = event.target;

    if (el.matches("input[type=checkbox]")) {
      const actorID = el.dataset.id;
      const actor = this._actors.find((o) => o.id === actorID);
      if (!actor) return;
      actor.selected = el.checked;
    }

    if (el.matches("input[name=bonusXP]")) {
      this._bonusXP = parseInt(el.value);
      if (isNaN(this._bonusXP)) this._bonusXP = 0;
    }

    this.render({ parts: ["form"] });
  }

  /* -------------------------------------------- */

  /**
   * Distributes experience to all PC actors
   *
   * @internal
   * @param {boolean} splitEvenly - Should XP be split evenly?
   * @returns {void}
   */
  async _giveExperience(splitEvenly = false) {
    const value = splitEvenly ? this.splitExperience : this.totalExperience;

    if (value > 0) {
      const characters = this.characters.filter((o) => o.selected);

      for (const actorData of characters) {
        const result = { value };
        Hooks.callAll("pf1GainXp", actorData.actor, result);
        actorData.value = Math.floor(result.value);
      }

      const updates = characters
        .filter((o) => o.value > 0 && Number.isSafeInteger(o.value))
        .map((o) => ({
          _id: o.actor.id,
          "system.details.xp.value": o.actor.system.details.xp.value + o.value,
        }));

      Actor.implementation.updateDocuments(updates);
    }

    this.close();
  }

  /* -------------------------------------------- */

  /**
   * Distribute XP evenly between actors
   *
   * @param event
   * @static
   * @internal
   * @this {ApplicationV2&ExperienceDistributor}
   * @returns {Promise<void>}
   */
  static async _split(event) {
    event.preventDefault();
    await this._giveExperience(true);
    this.close();
  }

  /* -------------------------------------------- */

  /**
   * Give all XP to all actors
   *
   * @param event
   * @static
   * @internal
   * @this {ApplicationV2&ExperienceDistributor}
   * @returns {Promise<void>}
   */
  static async _giveAll(event) {
    event.preventDefault();
    await this._giveExperience(false);
    this.close();
  }

  /* -------------------------------------------- */

  /**
   * Cancel distribution and close dialog
   *
   * @param event
   * @static
   * @internal
   * @this {ApplicationV2&ExperienceDistributor}
   * @returns {Promise<void>}
   */
  static _cancel(event) {
    event.preventDefault();
    this.close();
  }

  /* -------------------------------------------- */

  /**
   * Total experience the encounter is worth, including regular XP reward and bonus XP.
   *
   * @returns {number} - Total value
   */
  get totalExperience() {
    const npcs = this.npcs.filter((o) => o.selected);
    return npcs.reduce((cur, o) => cur + o.xp, this._bonusXP);
  }

  /* -------------------------------------------- */

  /**
   * Split experience, as split across all characters.
   *
   * @returns {number} - Reward value
   */
  get splitExperience() {
    const characters = this.characters.filter((o) => o.selected);
    if (characters.length === 0) return 0;
    const xp = this.totalExperience;
    return Math.floor(xp / characters.length);
  }

  /* -------------------------------------------- */

  /**
   * @protected
   * @param {Actor} actor
   * @returns {ExperienceDistributorActor}
   */
  static getActorData(actor) {
    if (!(actor instanceof Actor)) return null;

    const xp = actor.system.details?.xp?.value ?? 0;

    return {
      id: foundry.utils.randomID(16),
      isNPC: actor.type !== "character",
      actor,
      selected: this._shouldActorBeSelected(actor),
      xp,
      xpString: xp.toLocaleString(),
    };
  }

  /* -------------------------------------------- */

  /**
   * Should the actor be selected by default.
   *
   * @param {Actor} actor
   * @returns {boolean}
   */
  static _shouldActorBeSelected(actor) {
    const isPC = actor.type === "character";
    if (isPC) return true;

    const healthConfig = game.settings.get("pf1", "healthConfig");
    const actorType = { character: "pc", npc: "npc" }[actor.type];
    const useWoundsAndVigor = healthConfig.variants[actorType]?.useWoundsAndVigor ?? false;

    return useWoundsAndVigor ? actor.system.attributes?.wounds?.value <= 0 : actor.system.attributes?.hp?.value < 0;
  }

  /* -------------------------------------------- */

  /**
   * Open XP distributor dialog based on passed combat instance.
   *
   * @param {Combat} combat - Combat instance
   * @returns {ExperienceDistributor} - Application instance
   */
  static fromCombat(combat) {
    const app = new this({ actors: combat.combatants.map((c) => c.actor) });

    if (app.characters.length > 0) {
      app.render({ force: true });
    } else {
      app.close();
    }

    return app;
  }
}

/**
 * @typedef {object} ExperienceDistributorActor
 * @property {string} id - Internal reference ID
 * @property {ActorPF} actor - Actor instance
 * @property {boolean} isNPC - Is this an NPC?
 * @property {boolean} selected - Is the actor selected
 * @property {number} xp
 * @property {string} xpString
 */
