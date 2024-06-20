import { PF1SidebarTour } from "./base-tours.mjs";

export class CreateNPCTour extends PF1SidebarTour {
  STEPS = {
    GO_TO_ACTORS_TAB: "goto-actors",
    SET_NAME: "set-name",
    SET_TYPE: "set-type",
    CLICK_CREATE: "click-create",
  };

  /** @override */
  async start() {
    game.togglePause(true);
    ui.sidebar.activateTab("actors");
    await super.start();
  }

  /** @override */
  async _postStep() {
    /** @type {string | undefined} */
    const currentStepId = this.currentStep?.id;

    switch (currentStepId) {
      case this.STEPS.GO_TO_ACTORS_TAB:
        // Open Create Actor menu
        document.querySelector("#actors button.create-document")?.click();
        break;
      case this.STEPS.CLICK_CREATE:
        // Create the NPC Actor
        document.querySelector("button[data-button=ok]")?.click();
        break;
      default:
        break;
    }

    await super._postStep();
  }

  /** @override */
  async _preStep() {
    await super._preStep();

    /** @type {string | undefined} */
    const currentStepId = this.currentStep?.id;

    switch (currentStepId) {
      case this.STEPS.SET_NAME:
        // Write the NPC name in the input
        document.querySelector("input[name='name']").value = "Generic Smith";
        break;
      case this.STEPS.SET_TYPE:
        // Select the NPC type
        document.querySelector("select[name='type']").value = "npc";
        break;
      default:
        break;
    }
  }
}
