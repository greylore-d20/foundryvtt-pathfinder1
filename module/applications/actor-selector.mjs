/**
 * Actor choice dialog.
 */
export class ActorSelector extends FormApplication {
  static searchOptions = {
    delay: 250,
    value: "",
    event: null,
    compositioning: false,
    effectiveSearch: "",
  };

  constructor(
    {
      actors,
      filter,
      disableUnowned = true,
      ownership = CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED,
      selected = null,
      showUnowned = true,
    } = {},
    options
  ) {
    super({}, options);

    this.actors = actors ?? [...game.actors];
    this.disableUnowned = disableUnowned;
    this.filterFunc = filter;
    this.ownership = ownership;
    this.search = { ...ActorSelector.searchOptions };
    this.selected = selected || "";
    this.showUnowned = showUnowned;

    if (!this.actors) throw new Error("No actors list provided.");
  }

  get title() {
    return this.options.title || game.i18n.localize("PF1.Application.ActorSelector.Title");
  }

  get template() {
    return "systems/pf1/templates/apps/actor-select.hbs";
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "pf1", "actor-selector"],
      height: "auto",
      submitOnClose: false,
      submitOnChange: true,
      closeOnSubmit: false,
      resizable: true,
    };
  }

  getData() {
    const gmActive = !!game.users.activeGM;
    let actorList = this.filterFunc ? this.actors.filter(this.filterFunc) : [...this.actors];

    // Filter the list by the search term as well.
    if (this.search.value) {
      actorList = actorList.filter((actor) => actor.name.toLowerCase().includes(this.search.value.toLowerCase()));
    }

    // Make sure the list is sorted alphabetically
    actorList.sort((a, b) => a.name.localeCompare(b.name));

    // Prepare the data separately for owned and unowned actors.
    const ownedActors = actorList
      .filter((actor) => actor.isOwner)
      .map((actor) => {
        return {
          id: actor.id,
          name: actor.name,
          img: actor.img,
          isDisabled: false,
        };
      });

    const unownedActors = actorList
      .filter((actor) => !actor.isOwner && actor.testUserPermission(game.user, this.ownership))
      .map((actor) => {
        return {
          id: actor.id,
          name: actor.name,
          img: actor.img,
          isDisabled: !gmActive && this.disableUnowned,
        };
      });

    return {
      selected: this.selected || "",
      ownedActors,
      unownedActors,
      showUnowned: game.user.isGM ? false : this.showUnowned,
      searchTerm: this.search.value,
    };
  }

  close(...args) {
    super.close(...args);
    this.resolve?.(null);
  }

  activateListeners(jq) {
    super.activateListeners(jq);

    const button = jq[0].querySelector("button.commit-select");

    button.addEventListener("click", this._onSaveSelection.bind(this));

    const sb = jq.find(".search-input");
    sb.on("keyup change", this._searchFilterChange.bind(this));
    sb.on("compositionstart compositionend", this._searchFilterCompositioning.bind(this)); // for IME
    jq.find(".clear-search").on("click", this._clearSearch.bind(this));
  }

  _onSaveSelection(_event) {
    this.resolve?.(this.selected || "");
    this.close();
  }

  _updateObject(_event, formData) {
    this.selected = formData.selected;
    this.render();
  }

  /**
   *  Process the search input and filter the actor list(s) on the fly.
   *
   * @param {Event} event - The triggering event
   * @returns {void}
   */
  _searchFilterCommit(event) {
    const searchTerm = this.search.value.toLowerCase();

    // Skip if the search term is the same as the last one
    if (this.search.effectiveSearch === searchTerm) return;
    this.search.effectiveSearch = searchTerm;
    this.render(true);
  }

  _clearSearch(event) {
    const sb = $(event.target).prev(".search-input");
    this.search.value = "";
    sb.val("").trigger("change");
  }

  // IME related
  _searchFilterCompositioning(event) {
    this.search.compositioning = event.type === "compositionstart";
  }

  /**
   * Update the search term and set a timeout to commit the search.
   *
   * @param {Event} event - The triggering event
   * @returns {void}
   */
  _searchFilterChange(event) {
    event.preventDefault();
    event.stopPropagation();

    // Accept input only while not compositioning

    const searchTerm = event.target.value;
    const changed = this.search.value !== searchTerm;

    if (this.search.compositioning || changed) clearTimeout(this.search.event); // reset
    if (this.search.compositioning) return;

    //if (unchanged) return; // nothing changed
    this.search.value = searchTerm;

    if (event.type === "keyup") {
      // Delay search
      if (changed) this.search.event = setTimeout(() => this._searchFilterCommit(event), this.search.delay);
    } else {
      this._searchFilterCommit(event);
    }
  }

  /**
   * Render actor selector and wait for it to resolve.
   *
   * @param {object} options - Options
   * @param {Actor[]} [options.actors] - The actors list to choose from.
   * @param {boolean} [options.disableUnowned=true] - Disable interactions with unowned actors.
   * @param {Function} options.filter - Filter function
   * @param {*} options.ownership=CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED - Minimum Ownership level
   * @param {string} [options.selected=null] - Already selected actor ID.
   * @param {boolean} [options.showUnowned=true] - Whether to show unowned actors.
   * @param {object} [renderOptions] - Render options
   * @param {object} [appOptions] - Application options
   * @param options.ownership
   * @returns {Promise<string|null>} - Actor ID or null if cancelled.
   */
  static wait(
    {
      actors,
      filter,
      disableUnowned = true,
      ownership = CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED,
      selected = null,
      showUnowned = true,
    } = {},
    appOptions,
    renderOptions
  ) {
    const old = Object.values(ui.windows).find(
      (app) => app instanceof pf1.applications.ActorSelector && app.id === appOptions.id
    );
    if (old) {
      old.render(false, { focus: true });
      return null;
    }

    return new Promise((resolve) => {
      const app = new this({ actors, filter, disableUnowned, ownership, selected, showUnowned }, appOptions);
      app.resolve = resolve;
      app.render(true, renderOptions);
    });
  }
}
