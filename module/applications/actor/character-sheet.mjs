import { ActorSheetPF } from "./actor-sheet.mjs";
import { LevelUpForm } from "../level-up.mjs";

/**
 * An Actor sheet for player character type actors in the PF system.
 * Extends the base ActorSheetPF class.
 *
 * @type {ActorSheetPF}
 */
export class ActorSheetPFCharacter extends ActorSheetPF {
  /**
   * Define default rendering options for the NPC sheet
   *
   * @returns {object}
   */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pf1", "sheet", "actor", "character"],
      width: 800,
      height: 840,
    });
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
    if (this.actor.limited) return "systems/pf1/templates/actors/limited-sheet.hbs";
    return "systems/pf1/templates/actors/character-sheet.hbs";
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  async getData() {
    const data = await super.getData();
    const xpSettings = game.settings.get("pf1", "experienceConfig");

    // Experience Tracking
    data.disableExperience = xpSettings.disableExperienceTracking;
    data.minimumExperience = this.actor.getLevelExp(Math.max(0, (this.actor.system.details.level.value ?? 0) - 1));

    data.hasClasses = this.actor.items.filter((o) => o.type === "class").length > 0;

    const hpSettings = game.settings.get("pf1", "healthConfig");
    data.woundThresholds = hpSettings.variants.pc;

    // BAB iteratives
    const iteratives = game.settings.get("pf1", "displayIteratives");
    const bab = data.rollData.attributes.bab.total;
    if (iteratives) {
      const iters = [bab];
      for (let i = bab - 5; i > 0; i -= 5) iters.push(i);
      data.iteratives = `+${iters.join(" / +")}`;
    }

    // Add level up buttons to classes
    if (
      this.actor.type === "character" &&
      game.settings.get("pf1", "experienceConfig").disableExperienceTracking !== true &&
      data.hasClasses
    ) {
      const xp = this.actor.system.details?.xp;
      if (xp && xp.value >= xp.max) {
        data.levelUp = true;
      }
    } else {
      data.levelUp = true;
    }

    // Return data for rendering
    return data;
  }
}
