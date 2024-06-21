import { PF1Tour } from "./base-tours.mjs";

export class CreateNPCTour extends PF1Tour {
  /**
   * Steps of the tour. Try to keep synced with `create-npc.json`.
   * TODO: This should either validated with {@link PF1Tour.steps} or by automation.
   */
  STEPS = {
    GO_TO_ACTORS_TAB: "goto-actors",
    SET_NAME: "set-name",
    SET_TYPE: "set-type",
    CLICK_CREATE: "click-create",
    HIGHLIGHT_SHEET: "highlight-sheet",
    SELECT_RACE: "select-race",
    OPEN_RACE_COMPENDIUM: "open-race-compendium",
    ALL_RACES_DISPLAY: "all-races-display",
    FILTER_HIGHLIGHT: "filter-highlight",
    HIGHLIGHT_RACE: "highlight-race",
    HIGHLIGHT_SELECTED_RACE: "highlight-selected-race",
    HIGHLIGHT_ACTOR_CLASSES: "highlight-actor-classes",
    OPEN_CLASSES_COMPENDIUM: "open-classes-compendium",
    HIGHLIGHT_CLASSES_COMPENDIUM: "highlight-classes-compendium",
    HIGHLIGHT_CLASSES_COMPENDIUM_FILTER: "highlight-classes-compendium-filter",
    HIGHLIGHT_CLASS_IN_COMPENDIUM: "highlight-class-in-compendium",
    LEVELUP_DIALOG: "levelup-dialog",
    LEVELUP_DIALOG_HIGHLIGHT_SUMMARY: "levelup-dialog-highlight-summary",
    LEVELUP_DIALOG_HIGHLIGHT_HEALTH: "levelup-dialog-highlight-health",
    LEVELUP_DIALOG_HIGHLIGHT_FCB: "levelup-dialog-highlight-fcb",
    LEVELUP_DIALOG_HIGHLIGHT_ABILITY_SCORE: "levelup-dialog-highlight-ability-score",
    LEVELUP_DIALOG_ROLL_PRIVACY: "levelup-dialog-roll-privacy",
    LEVELUP_DIALOG_FINISH: "levelup-dialog-finish",
    HIGHLIGHT_SELECTED_CLASS: "highlight-selected-class",
  };

  /** @type {import("@actor/actor-npc.mjs").ActorNPCPF | null} */
  createdActor = null;
  /** @type {string} The cache ID of the created actor */
  createdActorCacheId = "p1.createNPC.createdActor";

  /** @override */
  constructor(config, { id, namespace } = {}) {
    super(config, { id, namespace });
    // Retrieve the actor from Cache if it exists. This means the user has come back to an 'in-progress' tour
    this.createdActor = localStorage.getItem(this.createdActorCacheId)
      ? game.actors.get(localStorage.getItem(this.createdActorCacheId))
      : null;
  }

  /**
   * Sets the ID of the created actor and saves it in cache.
   *
   * @param {string} actorId The ID of the created actor.
   */
  setCreatedActor(actorId) {
    this.createdActor = game.actors.get(actorId);
    localStorage.setItem(this.createdActorCacheId, actorId);
  }

  /**
   * Function wrap for very common call.
   * Deletes the actor of the sheet in display. Mainly use for rollback.
   */
  async _deleteActorFromActiveSheet() {
    await this.sheetInDisplay?.actor?.delete();
  }

  /**
   * Removes an item from the actor. Mainly use for rollback.
   *
   * @param {string} itemId The ID of the item to remove.
   */
  _removeItemInActor(itemId) {
    this._debug("Remove item (%s) from actor", itemId);
    this.createdActor?.items.find((i) => i.id === itemId)?.delete();
  }

  /**
   * Cleans up given class or all classes of the sheet in display. Mainly use for rollback.
   *
   * @param {string | "class" | "race"} idOrItemType The ID of the class to clean up.
   */
  _cleanUp(idOrItemType) {
    /** @type {Map<string, pf1.documents.item.ItemClassPF | pf1.documents.item.ItemRacePF>} */
    const allowedItemTypes = new Map([
      ["class", pf1.documents.item.ItemClassPF],
      ["race", pf1.documents.item.ItemRacePF],
    ]);

    if (allowedItemTypes.has(idOrItemType)) {
      this.createdActor?.items
        .filter((item) => item instanceof allowedItemTypes.get(idOrItemType))
        .forEach((itemOfSelectedType) => this._removeItemInActor(itemOfSelectedType.id));
    } else {
      this._removeItemInActor(idOrItemType);
    }
  }

  /**
   * In many steps we need this menu to be opened to continue.
   */
  _openCreateActorMenu() {
    // Open Create Actor menu
    /** @type {ActorDirectory} */
    const actorsTab = ui.sidebar.tabs.actors;
    actorsTab.activate();
    actorsTab.element?.find("button.create-document")?.click();
  }

  /**
   * In many steps we need this sheet to be opened to continue.
   *
   * @param {object} [options={}] Additional options to pass to the render function.
   * @returns {import("@app/actor/actor-sheet.mjs").ActorSheetPF | null} The opened Actor sheet.
   * @see {@link Application.render}
   */
  _openCreatedNPCSheet(options = {}) {
    if (!this.createdActor) {
      this._warn("Trying to open a Sheet for an Actor that doesn't exist in the Tour object.");
      ui.notifications.warn("PF1.Tours.RestartTutorialWarning", { localize: true });
      return null;
    }
    /** @type {import("@app/actor/actor-sheet.mjs").ActorSheetPF | null} */
    const sheet = this.createdActor.sheet;
    if (!sheet) return null;
    // Open Actor sheet
    return sheet.render(true, { focus: true, ...options });
  }

  /**
   * Closes the level up dialog if it's open.
   * NOTE: This is assuming the only application of type `LevelUpForm` is the one created in the tour.
   */
  _closeLevelUpDialog() {
    /** @type {pf1.applications.LevelUpForm | undefined} */
    const levelUpForm = Object.values(ui.windows).find((app) => app instanceof pf1.applications.LevelUpForm);
    if (levelUpForm) levelUpForm.close();
  }

  async _setActorName() {
    // Not necessary but funny. Some random NPC names so it's not always Bob or so
    const randomNamesForNPCs = ["Generic Smith", "Bob Rando", "Droopy McCool", "Smoki Bacon", "Meep", "Bathroom Bobby"];
    /** @type {HTMLInputElement} */
    const nameInput = await this.waitForElement(this.getStepById(this.STEPS.SET_NAME)?.selector);
    nameInput.value = randomNamesForNPCs[Math.floor(Math.random() * randomNamesForNPCs.length)];
  }

  async _setActorTypeAsNPC() {
    /** @type {HTMLSelectElement} */
    const actorTypeSelect = await this.waitForElement(this.getStepById(this.STEPS.SET_TYPE)?.selector);
    actorTypeSelect.value = "npc";
  }

  /**
   * When accessing different steps of the Create Actor Menu we might required some data to be prepared.
   */
  async _prepareDefaultCreationMenuData() {
    await this._setActorName();
    await this._setActorTypeAsNPC();
  }

  /** @override */
  async start() {
    game.togglePause(true);
    ui.sidebar.tabs.actors.activate();

    // We want all to be closed for a fresh start
    Object.values(ui.windows).forEach((app) => app.close());
    /** See {@link Tour.start} */
    game.tooltip.clearPending();

    // Depending on the step we start we need to have the Create Actor menu open
    if (
      this.stepIndex >= this.getStepIndexById(this.STEPS.SET_NAME) &&
      this.stepIndex <= this.getStepIndexById(this.STEPS.CLICK_CREATE)
    ) {
      this._openCreateActorMenu();
      await this._prepareDefaultCreationMenuData();
    }

    // Depending on the step we start we need to have the Actor sheet open
    if (this.stepIndex >= this.getStepIndexById(this.STEPS.HIGHLIGHT_SHEET)) {
      this._openCreatedNPCSheet();
    }

    // Depending on the step we start we need to have the race compendium open
    if (
      this.stepIndex >= this.getStepIndexById(this.STEPS.ALL_RACES_DISPLAY) &&
      this.stepIndex <= this.getStepIndexById(this.STEPS.HIGHLIGHT_RACE)
    ) {
      // In order to have the compendium on top of the sheet we need to wait for it
      await this.waitForSheetInDisplay();
      this._openCompendium("races");
    }

    // Depending on the step we start we need to have the class compendium open
    if (
      this.stepIndex >= this.getStepIndexById(this.STEPS.HIGHLIGHT_CLASSES_COMPENDIUM) &&
      this.stepIndex <= this.getStepIndexById(this.STEPS.LEVELUP_DIALOG)
    ) {
      // In order to have the compendium on top of the sheet we need to wait for it
      await this.waitForSheetInDisplay();
      this._openCompendium("classes");
    }

    // If the tour is started somewhere in between the Level Up Dialog options we need to move back
    // to "Select Highlighted Class"
    if (
      this.stepIndex >= this.getStepIndexById(this.STEPS.LEVELUP_DIALOG) &&
      this.stepIndex <= this.getStepIndexById(this.STEPS.LEVELUP_DIALOG_FINISH)
    ) {
      await this.waitForSheetInDisplay();
      this._openCompendium("classes");
      /**
       * We need to be very careful here. Returning the progress is how `Tour.start` works.
       *
       * @see {@link Tour.start}
       */
      return this.progress(this.getStepIndexById(this.STEPS.HIGHLIGHT_CLASS_IN_COMPENDIUM));
    }

    await super.start();
  }

  /** @override */
  async reset() {
    await super.reset();
    // Since it's a reset we also want to set currentNPC to null
    this.createdActor = null;
    // Remove cache
    localStorage.removeItem(this.createdActorCacheId);
  }

  /** @override */
  async progress(stepIndex) {
    // If the user is coming from pressing "Previous" we don't want to open the Dialog again
    if (this.steps[stepIndex]?.id === this.STEPS.SET_NAME && this._isSafe()) {
      this._openCreateActorMenu();
    }

    await super.progress(stepIndex);
  }

  /** @override */
  async _preStep() {
    await super._preStep();

    /** @type {string | undefined} */
    const currentStepId = this.currentStep?.id;

    switch (currentStepId) {
      case this.STEPS.SET_NAME:
        await this._setActorName();
        break;
      case this.STEPS.SET_TYPE:
        await this._setActorTypeAsNPC();
        break;
      case this.STEPS.ALL_RACES_DISPLAY:
        // Clean up the search bar in case it's not empty
        await this._typeInCompendiumBrowserSearchBar("");
        break;
      case this.STEPS.HIGHLIGHT_RACE:
        // Write race name in the search bar
        // We need to trigger the event like we were writing the name in order for the browser to update the filter
        // NOTE: This is assuming step 8 is `FILTER_HIGHLIGHT`
        await this._typeInCompendiumBrowserSearchBar("gnome");
        break;
      case this.STEPS.HIGHLIGHT_SELECTED_RACE:
        // Close the race CompendiumBrowser
        this._closeCompendium();
        break;
      case this.STEPS.HIGHLIGHT_CLASSES_COMPENDIUM:
        // Clean up the search bar in case it's not empty
        await this._typeInCompendiumBrowserSearchBar("");
        break;
      case this.STEPS.HIGHLIGHT_CLASS_IN_COMPENDIUM:
        // Populate the search bar with the class name
        await this._typeInCompendiumBrowserSearchBar("fighter");
        break;
      case this.STEPS.LEVELUP_DIALOG:
        // Close the class CompendiumBrowser
        this._closeCompendium();
        break;
      case this.STEPS.LEVELUP_DIALOG_HIGHLIGHT_FCB:
        // Select Hit Points as FCB
        // FIXME: It shouldn't happen but since it's so of a wacky workaround it could happen that
        // the element for the current step is not found.
        this._getTargetElement(this.currentStep?.selector).querySelector(
          "input[name='fcb.choice'][value='hp']"
        ).checked = true;
        break;
      default:
        break;
    }
  }

  /** @override */
  async _postStep() {
    /** @type {string | undefined} */
    const currentStepId = this.currentStep?.id;

    switch (currentStepId) {
      case this.STEPS.CLICK_CREATE:
        if (this._isSafe()) {
          // Create the NPC Actor otherwise
          this.targetElement?.click();
          // Save created actor in memory and cache
          this.setCreatedActor((await this.waitForSheetInDisplay())?.actor?.id);
        }
        break;
      case this.STEPS.OPEN_RACE_COMPENDIUM:
        if (this._isSafe()) {
          // Open the race CompendiumBrowser otherwise
          this._openCompendium("races", { focus: false });
        }
        break;
      case this.STEPS.HIGHLIGHT_RACE:
        if (this._isSafe()) {
          // Trigger drag and drop event into the sheet
          await this._dropItemFromCompendiumBrowser(this.currentStep?.selector);
        }
        break;
      case this.STEPS.OPEN_CLASSES_COMPENDIUM:
        if (this._isSafe()) {
          // Open the classes CompendiumBrowser otherwise
          this._openCompendium("classes");
        }
        break;
      case this.STEPS.HIGHLIGHT_CLASS_IN_COMPENDIUM:
        if (this._isSafe()) {
          // Trigger drag and drop event into the sheet
          // The level up dialog will block the code since it's waiting for the user to finish
          // so we don't await it. Since we reset the tutorial on each Level Up Wizard App step we don't
          // care about the final item
          this._dropItemFromCompendiumBrowser(this.currentStep?.selector);
        }
        break;
      case this.STEPS.LEVELUP_DIALOG_FINISH:
        if (this._isSafe()) {
          // Click Finish on the levelup dialog
          this.targetElement?.click();
        }
        break;
      default:
        break;
    }

    await super._postStep();
  }

  /** @override */
  async previous() {
    // Some cleanup in case users go back
    if (this.previousStep?.id === this.STEPS.GO_TO_ACTORS_TAB) {
      // Close the Create Actor dialog that should be active
      ui.activeWindow.close();
    }
    // Going back right before creating the NPC
    if (this.previousStep?.id === this.STEPS.CLICK_CREATE) {
      // Remove the NPC actor after clicking Create
      await this._deleteActorFromActiveSheet();
      this._openCreateActorMenu();
      await this._prepareDefaultCreationMenuData();
    }
    // Going back once opened the race compendium browser for the first time
    if (this.previousStep?.id === this.STEPS.OPEN_RACE_COMPENDIUM) {
      this._closeCompendium();
    }

    // Going back after closing the race compendium browser (because we selected a race)
    if (this.previousStep?.id === this.STEPS.HIGHLIGHT_RACE) {
      this._cleanUp("race");
      this._openCompendium("races");
    }

    // Going back once opened the class compendium browser for the first time
    if (this.previousStep?.id === this.STEPS.OPEN_CLASSES_COMPENDIUM) {
      this._closeCompendium();
    }

    // Going back after simulating CompendiumBrowser Drag&Drop of class
    if (this.previousStep?.id === this.STEPS.HIGHLIGHT_CLASS_IN_COMPENDIUM) {
      this._closeLevelUpDialog();
      this._openCompendium("classes");
    }

    // If trying to go back after finishing the levelup dialog we need to delete the class
    // and go back to Highlight Selected Class in the compendium
    if (this.previousStep?.id === this.STEPS.LEVELUP_DIALOG_FINISH) {
      this._cleanUp("class");
      this._openCompendium("classes");
      // We manually handle the progress to previous. Then stop function
      await this.progress(this.getStepIndexById(this.STEPS.HIGHLIGHT_CLASS_IN_COMPENDIUM));
      return;
    }

    await super.previous();
  }

  /** @override */
  exit() {
    // Close Create Actor Dialog
    if (
      this.stepIndex >= this.getStepIndexById(this.STEPS.SET_NAME) &&
      this.stepIndex <= this.getStepIndexById(this.STEPS.CLICK_CREATE)
    ) {
      this._debug("Close Create Actor Dialog");
      ui.activeWindow.close();
    }

    // Close NPC Sheet in the steps that is opened
    if (this.stepIndex >= this.getStepIndexById(this.STEPS.HIGHLIGHT_SHEET)) {
      this._debug("Close NPC Sheet");
      this.sheetInDisplay?.close();
    }

    // Close race Compendium in the steps that is opened
    if (
      this.stepIndex >= this.getStepIndexById(this.STEPS.ALL_RACES_DISPLAY) &&
      this.stepIndex <= this.getStepIndexById(this.STEPS.HIGHLIGHT_CLASSES_COMPENDIUM)
    ) {
      this._debug("Close Race Compendium Browser");
      this._closeCompendium();
    }

    // Close class Compendium
    if (
      this.stepIndex >= this.getStepIndexById(this.STEPS.HIGHLIGHT_CLASSES_COMPENDIUM) &&
      this.stepIndex <= this.getStepIndexById(this.STEPS.LEVELUP_DIALOG_FINISH)
    ) {
      this._debug("Close Class Compendium Browser");
      this._closeCompendium();
    }

    // Close levelup dialog
    if (
      this.stepIndex >= this.getStepIndexById(this.STEPS.LEVELUP_DIALOG) &&
      this.stepIndex <= this.getStepIndexById(this.STEPS.LEVELUP_DIALOG_FINISH)
    ) {
      this._debug("Close Levelup Dialog");
      this._closeLevelUpDialog();
      // The Level Up Dialog needs to be finished or restarted
      game.tooltip.clearPending();
      this.progress(this.getStepIndexById(this.STEPS.HIGHLIGHT_CLASS_IN_COMPENDIUM));
    }

    super.exit();
  }
}
