export class PartyRestConfig extends FormApplication {
  constructor(config, options) {
    super(options);

    this.config = config;

    this.constructor._prepareActors(config);

    this.constructor._calculateHours(config, config.hours === undefined);
  }

  static _prepareActors(config) {
    const { longTermCare, restoreHealth, restoreUses, restOptions } = config;

    config.actors = config.actors.map((a) => {
      const conscious = this._isConscious(a);
      return {
        name: a.token?.name || a.name,
        img: a.token?.img || a.prototypeToken?.texture?.src || a.img,
        uuid: a.uuid,
        conscious,
        watch: conscious,
        options: {
          ...restOptions,
          longTermCare,
          restoreHealth,
          restoreUses,
        },
      };
    });
  }

  static _isConscious(actor) {
    const hpconf = game.settings.get("pf1", "healthConfig").variants;
    const variant = actor.type === "npc" ? hpconf.npc : hpconf.pc;
    const vigor = variant.useWoundsAndVigor;

    // TODO: Wounds & Vigor
    if (vigor) {
      const hp = actor.system.attributes.wounds;
      return hp.value >= hp.threshold;
    }
    // normal health
    else {
      const hp = actor.system.attributes.hp;
      return hp.value + hp.temp >= 0;
    }
  }

  static _calculateHours(config, updateTime = true) {
    const nowatch = config.watches === "none";
    const duo = config.watches === "duo";
    const solo = !duo;

    // Count watchers and pretend zero watchers results in math related to single person sleeping
    const active = nowatch ? 1 : Math.max(1, config.actors.filter((a) => a.watch).length);

    const cfg = pf1.config.partyRest[active] ?? Object.values(pf1.config.partyRest).at(-1);

    let hours = config.hours;
    // Skip time update if it was manually adjusted
    if (updateTime) {
      if (solo) hours = cfg.hours;
      else hours = cfg.double ?? cfg.hours;
      config.hours = hours;
    }

    // Set time needed per watch
    if (active > 1) {
      const watchTime = Math.clamped(hours, 0, 24);
      config.watchTime = watchTime / (solo ? active : Math.floor(active / 2));
    } else {
      config.watchTime = 0;
    }

    // Check if double watches are available for this group with this many watchers
    config.duo = cfg.double ?? false;
    if (!config.duo && duo) config.watches = "solo";
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: ["pf1", "party-rest"],
      template: "systems/pf1/templates/apps/party-rest.hbs",
      width: 500,
      submitOnChange: true,
      submitOnClose: false,
      closeOnSubmit: false,
    };
  }

  get title() {
    return game.i18n.localize("PF1.Application.PartyRest.Title");
  }

  getData() {
    const watching = this.config.actors.filter((a) => a.watch).length;

    return {
      ...this.config,
    };
  }

  /**
   * Call individual actor rest functions and pass time.
   *
   * @param {Event} event
   */
  async _doRest(event) {
    event.preventDefault();

    // Disable inputs
    this.form.classList.add("processing");
    for (const el of this.form.elements) {
      el.disabled = true;
    }

    await this.constructor._performRest(this.config);

    ui.notifications.info(
      game.i18n.format("PF1.Application.PartyRest.Rested", {
        people: this.config.actors.length,
        hours: pf1.utils.limitPrecision(this.config.hours, 1),
      })
    );

    this.resolve(this.config);
    this.close();
  }

  static async _performRest(config) {
    //
    const { actors, hours } = this.config;

    const promises = [];
    for (const actorData of actors) {
      const { restoreHealth, restoreUses, longTermCare, ...options } = actorData.options;
      const actor = fromUuidSync(actorData.uuid);
      if (!actor) continue;
      console.log(options);
      //return;
      const p = actor.performRest({ ...options, restoreHealth, restoreDailyUses: restoreUses, longTermCare });
      promises.push(p);
    }

    await Promise.allSettled(promises);

    if (hours > 0 && game.user.isGM) await game.time.advance(Math.floor(hours * 3_600));
  }

  /**
   * @override
   * @param {Event} event
   * @param {object} formData
   */
  _updateObject(event, formData) {
    formData = foundry.utils.expandObject(formData);
    formData.actors = Object.values(formData.actors).map((a, idx) =>
      foundry.utils.mergeObject(this.config.actors[idx], a)
    );
    foundry.utils.mergeObject(this.config, formData);

    this.constructor._calculateHours(this.config, event.target.name !== "hours");

    this.render();
  }

  /**
   * @override
   */
  close(...args) {
    super.close(...args);
    this.resolve(null);
  }

  /**
   * @param {Event} event
   */
  async _onToggle(event) {
    const toggle = event.target.dataset.toggle;

    await this._onSubmit(event, { preventRender: true }); // Ensure form data is submitted

    const state = this.config.actors.some((a) => !a[toggle]);
    this.config.actors.forEach((a) => (a[toggle] = state));

    if (toggle === "watch") this._calculateHours(this.config);

    this.render();
  }

  /**
   * @override
   * @param {JQuery<HTMLElement>} jq
   */
  activateListeners(jq) {
    super.activateListeners(jq);

    const html = jq[0];

    // Header toggling all in column
    html.querySelectorAll(".toggle-all").forEach((el) => {
      el.addEventListener("click", (ev) => this._onToggle(ev));
    });

    // Perform rest button
    html.querySelector("button.submit").addEventListener("click", (ev) => this._doRest(ev));

    // Allow opening character sheet
    html.querySelectorAll(".actor").forEach((el) => {
      el.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();

        fromUuidSync(ev.target.dataset.actorUuid).sheet.render(true);
      });
    });
  }

  static async quickRest({
    actors = [],
    hours,
    restoreUses = true,
    restoreHealth = true,
    longTermCare = true,
    restOptions = {},
    watches = "none",
  } = {}) {
    const config = { actors, hours, restoreUses, restoreHealth, longTermCare, restOptions, watches };

    this._prepareActors(config);
    this._calculateHours(config, hours === undefined);

    await this._performRest(config);

    return config;
  }

  static async open(options) {
    return new Promise((resolve) => {
      const rd = new PartyRestConfig(options);
      rd.resolve = resolve;
      rd.render(true, { focus: true });
    });
  }
}

/**
 * Rest Party
 *
 * Time is passed if used by the GM.
 *
 * @param {options} options - Additional options
 * @param {Actor[]} options.actors - Actors to rest
 * @param {boolean} [options.watches=true] - People keep watch shifts.
 * @param {number} [options.hours=null] - How many hours to rest.
 * @param {boolean} [options.restoreHealth] - Restore health
 * @param {boolean} [options.restoreUses] - Restore daily uses
 * @param {boolean} [options.longTermCare] - Apply long term care
 * @param {object} [options.restOptions] - Additional options to pass to {@link ActorPF.performRest}
 * @returns {object|null} - Object with configuration resting was performed with, null if cancelled.
 */
export async function rest({
  actors = [],
  watches = true,
  hours = null,
  restoreHealth = true,
  restoreUses = true,
  longTermCare = false,
  skipDialog = false,
  restOptions = {},
} = {}) {
  actors = actors.filter((a) => a instanceof Actor && a.isOwner);
  if (actors.length == 0) throw new Error("No valid actors chosen to rest");

  if (typeof watches === "boolean") watches = watches ? "solo" : "none";

  if (skipDialog) {
    return PartyRestConfig.quickRest({ actors, hours, restoreUses, restoreHealth, longTermCare, restOptions });
  } else {
    return PartyRestConfig.open({ actors, watches, hours, restoreUses, restoreHealth, longTermCare, restOptions });
  }
}
