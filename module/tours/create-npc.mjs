import { PF1SidebarTour } from "./base-tours.mjs";

export class CreateNPCTour extends PF1SidebarTour {
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
   * FIXME: Find a better way to do this since it relies on the selector of the first step
   */
  _openCreateActorMenu() {
    // Open Create Actor menu
    document.querySelector(this.steps[0]?.selector)?.click();
  }

  /**
   * In many steps we need this sheet to be opened to continue.
   */
  _openActorSheet() {
    // Open Actor sheet
    this.createdNPC?.sheet?.render(true);
  }

  async _setActorName() {
    // Not necessary but funny. Some random NPC names so it's not always Bob or so
    const randomNamesForNPCs = ["Generic Smith", "Bob Rando", "Droopy McCool", "Smoki Bacon", "Meep", "Bathroom Bobby"];
    /** @type {HTMLInputElement} */
    const nameInput = await this.waitForElement(this.steps[1]?.selector);
    nameInput.value = randomNamesForNPCs[Math.floor(Math.random() * randomNamesForNPCs.length)];
  }

  async _setActorTypeAsNPC() {
    /** @type {HTMLSelectElement} */
    const actorTypeSelect = await this.waitForElement(this.steps[2]?.selector);
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
    ui.sidebar.activateTab("actors");

    // We want all dialogs to be closed for a fresh start
    Object.values(ui.windows)
      .filter((app) => app instanceof Dialog)
      .forEach((app) => app.close());

    // Depending on the step we start we need to have the Create Actor menu open
    if (this.stepIndex >= 2 && this.stepIndex <= 3) {
      this._openCreateActorMenu();
      await this._prepareDefaultCreationMenuData();
    }

    // Depending on the step we start we need to have the Actor sheet open
    if (this.stepIndex >= 4) {
      this._openActorSheet();
    }

    await super.start();
  }

  /** @override */
  async _preStep() {
    /** @type {string | undefined} */
    const currentStepId = this.currentStep?.id;

    switch (currentStepId) {
      case this.STEPS.SET_NAME:
        if (!this.calledAsPreviousStep) {
          this._openCreateActorMenu();
        }
        await this._setActorName();
        break;
      case this.STEPS.SET_TYPE:
        await this._setActorTypeAsNPC();
        break;
      case this.STEPS.HIGHLIGHT_SHEET:
        this.createdNPC = (await this.waitForSheetInDisplay())?.actor;
        break;
      case this.STEPS.ALL_RACES_DISPLAY:
        // Clean up the search bar in case it's not empty
        await this._typeInInputField(this.steps[8]?.selector, "");
        break;
      case this.STEPS.HIGHLIGHT_RACE:
        // Write race name in the search bar
        // We need to trigger the event like we were writing the name in order for the browser to update the filter
        // NOTE: This is assuming step 8 is `FILTER_HIGHLIGHT`
        await this._typeInInputField(this.steps[8]?.selector, "gnome");
        break;
      case this.STEPS.HIGHLIGHT_SELECTED_RACE:
        // Trigger drag and drop event into the sheet
        this.sheetInDisplay?._onDropItem(new DragEvent("drop"), {
          type: "Item",
          uuid: document.querySelector(this.previousStep?.selector)?.getAttribute("data-uuid"),
        });
        // Close the race CompendiumBrowser
        ui.activeWindow.close();
        break;
      default:
        break;
    }

    await super._preStep();
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
        this.targetElement.click();
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
  async exit() {
    /** @type {string | undefined} */
    const currentStepId = this.currentStep?.id;

    switch (currentStepId) {
      // Close the Create Actor dialog that should be active
      case this.STEPS.SET_NAME:
        ui.activeWindow.close();
        break;
      case this.STEPS.SET_TYPE:
        ui.activeWindow.close();
        break;
      case this.STEPS.CLICK_CREATE:
        ui.activeWindow.close();
        break;
      case this.STEPS.HIGHLIGHT_SHEET:
        ui.activeWindow.close();
        break;
      case this.STEPS.OPEN_RACE_COMPENDIUM:
        ui.activeWindow.close();
        break;
      default:
        break;
    }

    await super.exit();
  }
}
