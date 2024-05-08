export class ExperienceDistributor extends FormApplication {
  /**
   * @type {number} - Bonus XP granted
   */
  _bonusXP = 0;

  /**
   * @type {XPDistributorActor[]} - Special actor data array
   */
  _actors = [];

  /**
   * @param {ActorPF[]} [actors] - Actors to add to this distributor.
   * @param {object} [options] - Options for this application.
   */
  constructor(actors = [], options = {}) {
    super(undefined, options);
    this._actors = actors.map((o) => this.constructor.getActorData(o)).filter((o) => o != null);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["pf1", "xp-distributor"],
      title: game.i18n.localize("PF1.Application.XPDistributor.Title"),
      template: "systems/pf1/templates/apps/xp-distributor.hbs",
      dragDrop: [{ dragSelector: null, dropSelector: "form" }],
      submitOnChange: false,
      submitOnClose: false,
      closeOnSubmit: false,
      width: 430,
      height: 794,
      resizable: true,
      scrollY: [".selectors"],
    });
  }

  getData() {
    return {
      // Add combatants
      actors: {
        characters: this.getCharacters(),
        npcs: this.getNPCs(),
      },

      // Add labels
      xp: {
        total: this.getTotalExperience(),
        split: this.getSplitExperience(),
      },

      bonusXP: this._bonusXP,
    };
  }

  getCharacters() {
    return this._actors.filter((o) => !o.isNPC);
  }

  getNPCs() {
    return this._actors.filter((o) => o.isNPC);
  }

  activateListeners(jq) {
    super.activateListeners(jq);

    const html = this.form;

    const addListener = (query, ev, callback) =>
      html.querySelectorAll(query).forEach((elem) => elem.addEventListener(ev, callback));

    addListener(".character-selector .actor, .npc-selector .actor", "click", this._onClickActor.bind(this));

    addListener(".bonus-xp input", "change", (event) => {
      event.preventDefault();

      this._bonusXP = parseInt(event.currentTarget.value);
      if (isNaN(this._bonusXP)) this._bonusXP = 0;

      this.render();
    });

    addListener('button[name="split-evenly"], button[name="give-to-all"]', "click", this._onSubmit.bind(this));
    addListener('button[name="cancel"]', "click", this._onCancel.bind(this));
  }

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

      this.render();
    }
  }

  _onClickActor(event) {
    event.preventDefault();

    const el = event.currentTarget;
    const actorID = el.dataset.id;
    const actor = this._actors.find((o) => o.id === actorID);

    if (!actor) return;

    if (actor.selected) {
      actor.selected = false;
      el.classList.remove("toggled");
    } else {
      actor.selected = true;
      el.classList.add("toggled");
    }

    this.render();
  }

  async _onSubmit(event) {
    event.preventDefault();

    const type = event.currentTarget.name;

    const value = type === "split-evenly" ? this.getSplitExperience() : this.getTotalExperience();

    if (value > 0) {
      const characters = this.getCharacters().filter((o) => o.selected);

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

  _onCancel(event) {
    event.preventDefault();

    this.close();
  }

  /**
   * Total experience the encounter is worth, including regular XP reward and bonus XP.
   *
   * @returns {number} - Total value
   */
  getTotalExperience() {
    const npcs = this.getNPCs().filter((o) => o.selected);
    return npcs.reduce((cur, o) => cur + o.xp, this._bonusXP);
  }

  /**
   * Split experience, as split across all characters.
   *
   * @returns {number} - Reward value
   */
  getSplitExperience() {
    const characters = this.getCharacters().filter((o) => o.selected);
    if (characters.length == 0) return 0;

    const xp = this.getTotalExperience();

    return Math.floor(xp / characters.length);
  }

  /**
   * @protected
   * @param {Actor} actor
   * @returns {XPDistributorActor}
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

  /**
   * Should the actor be selected by default.
   *
   * @param {Actor} actor
   * @returns {boolean}
   */
  static _shouldActorBeSelected(actor) {
    const isPC = actor.type === "character";
    if (isPC) return true;

    const isDefeated = actor.system.attributes?.hp?.value < 0;
    return isDefeated;
  }

  /**
   * Open XP distributor dialog based on passed combat instance.
   *
   * @param {Combat} combat - Combat instance
   * @returns {ExperienceDistributor} - Application instance
   */
  static fromCombat(combat) {
    const app = new this(combat.combatants.map((c) => c.actor));

    if (app.getCharacters().length > 0) {
      app.render(true);
    } else {
      app.close();
    }

    return app;
  }
}

/**
 * @typedef {object} XPDistributorActor
 * @property {string} id - Internal reference ID
 * @property {ActorPF} actor - Actor instance
 * @property {boolean} isNPC - Is this an NPC?
 * @property {boolean} selected - Is the actor selected
 * @property {number} xp
 * @property {string} xpString
 */
