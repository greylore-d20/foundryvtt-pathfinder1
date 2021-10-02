export class ExperienceDistributor extends FormApplication {
  /**
   * @constructs ExperienceDistributor
   * @param {ActorPF[]} [actors] - Actors to add to this distributor.
   * @param {object} [options] - Options for this application.
   */
  constructor(actors = [], options = {}) {
    actors = actors
      .map((o) => {
        return ExperienceDistributor.getActorData(o);
      })
      .filter((o) => o != null);
    super(actors, options);
    this.bonusXP = 0;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pf1", "xp-distributor"],
      title: game.i18n.localize("PF1.Application.XPDistributor.Title"),
      template: "systems/pf1/templates/apps/xp-distributor.hbs",
      width: 430,
      height: 794,
      resizable: true,
      scrollY: [".selectors"],
    });
  }

  getData() {
    const result = super.getData();

    // Add combatants
    result.actors = {
      characters: this.getCharacters(),
      npcs: this.getNPCs(),
    };

    // Add labels
    result.labels = {
      xp: {
        total: `+ ${this.getTotalExperience().toLocaleString()}`,
        split: `+ ${this.getSplitExperience().toLocaleString()}`,
      },
    };

    result.bonusXP = this.bonusXP;

    return result;
  }

  getCharacters() {
    return this.object.filter((o) => o.actor.type === "character");
  }

  getNPCs() {
    return this.object.filter((o) => o.actor.type === "npc");
  }

  activateListeners(html) {
    if (jQuery != null && html instanceof jQuery) html = html[0];
    const addListener = (query, ev, callback) =>
      html.querySelectorAll(query).forEach((elem) => elem.addEventListener(ev, callback));

    addListener(".character-selector .actor, .npc-selector .actor", "click", this._onClickActor.bind(this));

    addListener(".bonus-xp input", "change", (event) => {
      event.preventDefault();

      this.bonusXP = parseInt(event.currentTarget.value);
      if (isNaN(this.bonusXP)) this.bonusXP = 0;

      this.render();
    });

    // Allow dropping actors from the sidebar to add them to the list
    html.addEventListener("drop", this._onDrop.bind(this));

    addListener('button[name="split-evenly"], button[name="give-to-all"]', "click", this._onSubmit.bind(this));
    addListener('button[name="cancel"]', "click", this._onCancel.bind(this));
  }

  _onDrop(event) {
    event.preventDefault();
    const data = JSON.parse(event.dataTransfer.getData("text/plain")) ?? {};

    // Add actor
    if (data.type === "Actor") {
      const actor = game.actors.get(data.id);

      // Prevent duplicate characters (not NPCs)
      if (actor.type !== "character" || this.object.find((o) => o.actor === actor) == null) {
        // Add actor to list
        this.object.push(mergeObject(this.constructor.getActorData(actor), { toggled: true }));
        this.render(true);
      }
    }
  }

  _onClickActor(event) {
    event.preventDefault();

    const a = event.currentTarget;
    const actorID = event.currentTarget.dataset.id;
    const actor = this.object.find((o) => o.id === actorID);

    if (!actor) return;

    if (actor.toggled) {
      actor.toggled = false;
      a.classList.remove("toggled");
    } else {
      actor.toggled = true;
      a.classList.add("toggled");
    }

    this.render();
  }

  async _onSubmit(event) {
    event.preventDefault();

    const type = event.currentTarget.name;

    const value = type === "split-evenly" ? this.getSplitExperience() : this.getTotalExperience();

    if (value > 0) {
      const characters = this.getCharacters().filter((o) => o.toggled);

      for (const actorData of characters) {
        const result = { value: value };
        Hooks.callAll("pf1.gainXp", actorData.actor, result);
        actorData.value = result.value;
      }

      const updates = characters
        .map((o) => {
          if (o.value === 0 || !Number.isFinite(o.value)) return null;
          return {
            _id: o.actor.id,
            "data.details.xp.value": o.actor.data.data.details.xp.value + Math.floor(o.value),
          };
        })
        .filter((o) => o != null);
      Actor.implementation.updateDocuments(updates);
    }

    this.close();
  }

  _onCancel(event) {
    event.preventDefault();

    this.close();
  }

  getTotalExperience() {
    const npcs = this.getNPCs().filter((o) => o.toggled);

    return npcs.reduce((cur, o) => {
      return cur + o.xp;
    }, this.bonusXP);
  }

  getSplitExperience() {
    const characters = this.getCharacters().filter((o) => o.toggled);
    const xp = this.getTotalExperience();

    const hasAnyCharacters = characters.length > 0;

    if (hasAnyCharacters) return Math.floor(xp / characters.length);
    return 0;
  }

  static getActorData(actor) {
    if (!(actor instanceof Actor)) return null;
    const type = actor.type;
    const xp = type === "npc" ? actor.data.data.details.xp.value ?? 0 : 0;

    return {
      id: randomID(16),
      actor: actor,
      toggled: this.shouldActorBeToggled(actor),
      xp,
      xpString: xp.toLocaleString(),
    };
  }

  static shouldActorBeToggled(actor) {
    const isPC = actor.type === "character";
    const isDefeated = actor.data.data.attributes.hp.value < 0;

    if (!isPC && !isDefeated) return false;

    return true;
  }
}
