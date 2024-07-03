export class ContentSourceEditor extends DocumentSheet {
  get title() {
    const label = game.i18n.format("PF1.ContentSource.Title", { name: this.document.name });
    const actor = this.document.actor;
    if (actor) return label + ` – ${actor.name}`;
    return label;
  }

  get template() {
    return "systems/pf1/templates/apps/content-source-editor.hbs";
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      tabs: [
        {
          contentSelector: "section.tabs",
          navSelector: "nav.tabs[data-group='sources']",
          group: "sources",
        },
      ],
      dragDrop: [{ dragSelector: "nav.tabs .source", dropSelector: null }],
      width: 540,
      height: "auto",
      resizable: true,
      submitOnChange: true,
      submitOnClose: true,
      closeOnSubmit: false,
      sheetConfig: false,
      classes: [...options.classes, "pf1", "content-source-editor"],
    };
  }

  /**
   * @internal
   * @override
   * @returns {object}
   */
  getData() {
    let canAdd = true;

    let sources = this.document.system.sources ?? [];

    // Prevent adding new sources if there's already an empty source
    if (sources.some((src) => Object.keys(src).length === 0)) canAdd = false;

    // Shallow clone sources for extra data
    sources = sources.map((src) => {
      const registry = pf1.registry.sources.get(src.id);
      return {
        ...src,
        registry,
      };
    });

    // Add default entry for editing when no entries exist
    if (sources.length === 0) {
      sources.push({ stub: true });
      canAdd = false;
    }

    return {
      sources,
      registry: pf1.registry.sources,
      uuid: this.document.uuid,
      canAdd,
    };
  }

  _getHeaderButtons() {
    // HACK: Do not display import button
    return super._getHeaderButtons().filter((b) => b.class !== "import");
  }

  /**
   * @internal
   * @param {Event} event
   */
  async _onAction(event) {
    event.preventDefault();

    const el = event.target;

    if (el.classList.contains("disabled")) return;

    switch (el.dataset.action) {
      case "add": {
        this.form.disabled = true;
        const sources = this.document.system.sources ?? [];
        await this.document.update({ "system.sources": [...sources, {}] });
        // Activate the newly created source tab
        this.activateTab(`source-${sources.length}`);
        break;
      }
      case "delete": {
        const idx = Number(el.dataset.index);
        if (Number.isFinite(idx) && idx >= 0) {
          const src = this.document.system.sources[idx];
          if (!src) return void this.render();
          const name =
            src.title || pf1.registry.sources.get(src.id)?.name || game.i18n.localize("PF1.ContentSource.NewEntry");

          const confirm = await Dialog.prompt({
            title: game.i18n.format("PF1.ContentSource.DelTitle", { entry: name }),
            content: game.i18n.format("PF1.ContentSource.DelEntryDesc", { entry: name }),
            callback: () => true,
            close: () => false,
            rejectClose: false,
          });

          if (confirm !== true) return;

          this.form.disabled = true;
          const updated = await this.document.update({
            "system.sources": this.document.system.sources.filter((_, sidx) => sidx !== idx),
          });
          if (!updated) this.render();
        }
        break;
      }
      default:
        console.warn("Unrecognized action:", el.dataset.action, el);
        break;
    }
  }

  /**
   * @internal
   * @override
   * @param {string} selector
   * @returns {boolean}
   */
  _canDragStart(selector) {
    if (this.document.inContainer) return false;
    return true;
  }

  /**
   * @internal
   * @override
   * @param {string} selector
   * @returns {boolean}
   */
  _canDragDrop(selector) {
    if (this.document.inContainer) return false;
    return this.isEditable;
  }

  /**
   * @internal
   * @override
   * @param {DragEvent} event
   */
  _onDragStart(event) {
    const el = event.currentTarget;

    const index = Number(el.dataset.index);
    const src = this.document.system.sources?.[index];

    if (!src) return false;

    // Set drag data
    const dragData = {
      type: "pf1ContentSourceEntry",
      uuid: this.document.uuid,
      index,
      data: {
        ...src,
      },
    };

    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /**
   * @internal
   * @override
   * @param {DragEvent} event
   */
  async _onDrop(event) {
    const dropData = TextEditor.getDragEventData(event);

    switch (dropData.type) {
      case "pf1ContentSourceEntry":
        this._onDropContentSource(event, dropData);
        break;
    }
  }

  /**
   * Handle content source drop
   *
   * @remarks
   * - Does not work correctly when dealing with
   * @internal
   * @param {DragEvent} event
   * @param {object} dropData
   */
  async _onDropContentSource(event, dropData) {
    let el = event.target;
    if (el.dataset.index === undefined) el = el.closest(".source[data-index]");
    let dropIndex = Number(el?.dataset.index);

    this.form.disabled = true;

    const src = dropData.data;
    const origin = fromUuidSync(dropData.uuid);
    if (!origin) return;

    // Sort
    if (origin === this.document) {
      if (!Number.isFinite(dropIndex) || dropIndex < 0) return;
      if (dropIndex === dropData.index) return;
      const sources = this.document.toObject().system.sources ?? [];
      const [moved] = sources.splice(dropData.index, 1);
      sources.splice(dropIndex, 0, moved);
      this.document.update({ "system.sources": sources });
    }
    // Copy
    else {
      const sources = this.document.toObject().system.sources ?? [];

      // Disallow same ID source copy
      if (src.id && sources.some((osrc) => osrc.id === src.id)) return; // TODO: Add error notification?

      // If dropped in odd location, add as last
      if (!Number.isFinite(dropIndex)) dropIndex = sources.length;
      sources.splice(dropIndex, 0, src);
      this.document.update({ "system.sources": sources });
    }
  }

  /**
   * @internal
   * @override
   * @param {JQuery<HTMLElement>} jq
   */
  activateListeners(jq) {
    super.activateListeners(jq);

    this.form
      .querySelectorAll("header .control")
      .forEach((el) => el.addEventListener("click", this._onAction.bind(this)));
  }

  /**
   * Open editor application for defined document.
   *
   * @param {Actor|Item} document Item or Actor reference
   * @returns {ContentSourceEditor} Reference to opened application.
   */
  static open(document) {
    const app =
      Object.values(ui.windows).find((app) => app instanceof this && app.object === document) ?? new this(document);
    app.render(true, { focus: true });
    return app;
  }

  _updateObject(event, updateData) {
    updateData = foundry.utils.expandObject(updateData);

    updateData.system.sources = Object.values(updateData.system.sources);

    const sources = updateData.system.sources;
    for (const source of sources) {
      // Remove empty data
      let empty = true;
      for (const [key, value] of Object.entries(source)) {
        if (value === null || value === "") {
          delete source[key];
        } else empty = false;
      }

      const registry = pf1.registry.sources.get(source.id);

      // Empty data that is auto-filled from registry
      if (registry) {
        delete source.title;
        delete source.publisher;
      }

      // Mark as empty for followup removal
      if (empty) source.empty = true;
    }

    updateData.system.sources = updateData.system.sources.filter((s) => s.empty !== true);

    return this.document.update(updateData);
  }
}
