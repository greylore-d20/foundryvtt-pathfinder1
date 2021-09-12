export class ExperienceDistributor extends FormApplication {
  constructor(...args) {
    super(...args);

    this.combatants = this.getCombatants();
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

    // Add associated combat data
    result.combat = this.object.data;

    // Add combatants
    result.combatants = {
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

  getCombatants() {
    return this.object.combatants.map((o) => this.constructor.getCombatantData(o));
  }

  getCharacters() {
    return this.combatants.filter((o) => o.actorData.type === "character");
  }

  getNPCs() {
    return this.combatants.filter((o) => o.actorData.type === "npc");
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

    addListener('button[name="split-evenly"], button[name="give-to-all"]', "click", this._onSubmit.bind(this));
    addListener('button[name="cancel"]', "click", this._onCancel.bind(this));
  }

  _onClickActor(event) {
    event.preventDefault();

    const a = event.currentTarget;
    const combatantID = event.currentTarget.dataset.id;
    const combatant = this.combatants.find((o) => o.id === combatantID);

    if (!combatant) return;

    if (combatant.toggled) {
      combatant.toggled = false;
      a.classList.remove("toggled");
    } else {
      combatant.toggled = true;
      a.classList.add("toggled");
    }

    this.render();
  }

  async _onSubmit(event) {
    event.preventDefault();

    const type = event.currentTarget.name;

    const value = type === "split-evenly" ? this.getSplitExperience() : this.getTotalExperience();

    if (value > 0) {
      for (let combatant of this.getCharacters()) {
        const combatantActive = combatant.toggled;
        const combatantHasActor = combatant.actor != null;

        if (combatantActive && combatantHasActor) {
          await combatant.actor.update({
            "data.details.xp.value": getProperty(combatant.actor.data, "data.details.xp.value") + value,
          });
        }
      }
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

  static getCombatantData(combatant) {
    const type = combatant.actor?.type;
    const xp = type === "npc" ? combatant.actor?.data.data.details.xp.value ?? 0 : 0;

    return {
      id: combatant.id,
      data: combatant.data,
      actor: combatant.actor,
      actorData: combatant.actor?.data ?? {},
      toggled: this.shouldCombatantBeToggled(combatant),
      xp,
      xpString: xp.toLocaleString(),
    };
  }

  static shouldCombatantBeToggled(combatant) {
    const isPC = combatant.actor?.type === "character";
    const isDefeated = combatant.data.defeated === true || combatant.actor?.data.data.attributes.hp.value < 0;

    if (!isPC && !isDefeated) return false;

    return true;
  }
}
