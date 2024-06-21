import { PF1Tour } from "./base-tours.mjs";

export class CreateNPCTour extends PF1Tour {
  /**
   * Steps of the tour. Try to keep synced with `create-npc.json`.
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
  };

  /** @type {import("@actor/actor-npc.mjs").ActorNPCPF | null} */
  createdNPC = null;

  /**
   * Function wrap for very common call.
   * Deletes the actor of the sheet in display. Mainly use for rollback.
   */
  async _deleteActorFromActiveSheet() {
    await this.sheetInDisplay?.actor?.delete();
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
   * @returns {import("@app/actor/actor-sheet.mjs").ActorSheetPF | null} The opened Actor sheet.
   */
  _openCreatedNPCSheet() {
    if (!this.createdNPC) {
      this._warn("Trying to open a Sheet for an Actor that doesn't exist in the Tour object.");
      ui.notifications.warn("PF1.Tours.RestartTutorialWarning", { localize: true });
      return null;
    }
    /** @type {import("@app/actor/actor-sheet.mjs").ActorSheetPF | null} */
    const sheet = this.createdNPC.sheet;
    if (!sheet) return null;
    // Open Actor sheet
    return sheet.render(true, { focus: true });
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

    // We want all dialogs to be closed for a fresh start
    Object.values(ui.windows)
      .filter((app) => app instanceof Dialog)
      .forEach((app) => app.close());

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
    if (this.stepIndex >= this.getStepIndexById(this.STEPS.ALL_RACES_DISPLAY)) {
      this._openCompendium("races");
    }

    await super.start();
  }

  /** @override */
  async progress(stepIndex) {
    // If the user is coming from pressing "Previous" we don't want to open the Dialog again
    if (this.steps[stepIndex]?.id === this.STEPS.SET_NAME && !this.calledAsPreviousStep) {
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
        await this._typeInInputField(this.getStepById(this.STEPS.FILTER_HIGHLIGHT)?.selector, "");
        break;
      case this.STEPS.HIGHLIGHT_RACE:
        // Write race name in the search bar
        // We need to trigger the event like we were writing the name in order for the browser to update the filter
        // NOTE: This is assuming step 8 is `FILTER_HIGHLIGHT`
        await this._typeInInputField(this.getStepById(this.STEPS.FILTER_HIGHLIGHT)?.selector, "gnome");
        break;
      case this.STEPS.HIGHLIGHT_SELECTED_RACE:
        // Trigger drag and drop event into the sheet
        this.sheetInDisplay?._onDropItem(new DragEvent("drop"), {
          type: "Item",
          uuid: document
            .querySelector(this.getStepById(this.STEPS.HIGHLIGHT_RACE)?.selector)
            ?.getAttribute("data-uuid"),
        });
        // Close the race CompendiumBrowser
        ui.activeWindow.close();
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
        // If the user is exiting the tour in this step or comes from pressing "Previous"
        // we don't want to create the NPC
        if (this.calledAsPreviousStep || this.calledAsExit || this.calledAsReset) {
          break;
        }
        // Create the NPC Actor otherwise
        this.targetElement?.click();
        // Set the variable `createdNPC` to the created NPC
        this.createdNPC = (await this.waitForSheetInDisplay())?.actor;
        break;
      case this.STEPS.OPEN_RACE_COMPENDIUM:
        // If the user is exiting the tour in this step or comes from pressing "Previous"
        // we don't want to open the race Compendium
        if (this.calledAsPreviousStep || this.calledAsExit || this.calledAsReset) {
          break;
        }
        // Open the race CompendiumBrowser otherwise
        this.targetElement.click();
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
    // Going back once opened the race compendium browser
    if (this.previousStep?.id === this.STEPS.OPEN_RACE_COMPENDIUM) {
      // Close the Compendium Browser App that should be active
      ui.activeWindow.close();
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
      this._debug("Closing Create Actor Dialog");
      ui.activeWindow.close();
    }

    // Close NPC Sheet
    if (
      this.stepIndex >= this.getStepIndexById(this.STEPS.HIGHLIGHT_SHEET) &&
      this.stepIndex <= this.getStepIndexById(this.STEPS.OPEN_RACE_COMPENDIUM)
    ) {
      this._debug("Closing NPC Sheet");
      ui.activeWindow.close();
    }

    // Close race Compendium and NPC Sheet
    if (this.stepIndex >= this.getStepIndexById(this.STEPS.ALL_RACES_DISPLAY)) {
      this._debug("Closing race Compendium");
      ui.activeWindow.close();

      this._debug("Closing NPC Sheet");
      this.sheetInDisplay?.close();
    }

    super.exit();
  }
}
