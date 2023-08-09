import { ActorSheetPF } from "./actor-sheet.mjs";
import { CR } from "../../utils/lib.mjs";
import { RollPF } from "../../dice/roll.mjs";

/**
 * An Actor sheet for NPC type characters in the game system.
 * Extends the base ActorSheetPF class.
 *
 * @type {ActorSheetPF}
 */
export class ActorSheetPFNPC extends ActorSheetPF {
  /**
   * Define default rendering options for the NPC sheet
   *
   * @returns {object}
   */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return { ...options, classes: [...options.classes, "npc"], width: 800, height: 840 };
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Get the correct HTML template path to use for rendering this particular sheet
   *
   * @type {string}
   */
  get template() {
    if (!game.user.isGM && this.actor.limited) return "systems/pf1/templates/actors/limited-sheet.hbs";
    return "systems/pf1/templates/actors/npc-sheet.hbs";
  }

  // static get name() {
  //   return game.i18n.localize("PF1.ActorSheetPFNPC");
  // }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  async getData() {
    const data = await super.getData();

    // Challenge Rating
    try {
      data.labels.cr = CR.fromNumber(this.actor.system.details?.cr?.total);
    } catch (e) {
      try {
        data.labels.cr = CR.fromNumber(this.actor.system.details?.cr);
      } catch (e) {
        data.labels.cr = CR.fromNumber(1);
      }
    }

    const hpSettings = game.settings.get("pf1", "healthConfig");
    data["woundThresholds"] = hpSettings.variants.npc;

    data.levelUp = true;

    return data;
  }

  /* -------------------------------------------- */
  /*  Object Updates                              */
  /* -------------------------------------------- */

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   *
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Adjust CR
    html.find("span.text-box.cr-input").on("click", (event) => {
      this._onSpanTextInput(event, this._adjustCR.bind(this));
    });
  }

  /* -------------------------------------------- */

  _adjustCR(event) {
    event.preventDefault();
    const el = event.currentTarget;

    const value = CR.fromString(el.tagName === "INPUT" ? el.value : el.innerText);
    const name = el.getAttribute("name");
    if (name) {
      this._pendingUpdates[name] = value;
    }

    // Update on lose focus
    if (event.originalEvent instanceof MouseEvent) {
      if (!this._submitQueued) {
        $(el).one("mouseleave", (event) => {
          this._onSubmit(event);
        });
      }
    } else this._onSubmit(event);
  }
}
