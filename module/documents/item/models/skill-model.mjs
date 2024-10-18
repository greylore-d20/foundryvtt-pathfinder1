export class SkillModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // Rank
      rank: new fields.NumberField({ integer: true, min: 0, required: false, initial: 0 }),
      // Unique skill identifier
      identifier: new fields.StringField({ required: false }),
      // Identifier of skill that this should be grouped under
      grouping: new fields.StringField({ required: false }),
      // Rules reference journal UUID
      reference: new fields.StringField({ required: false }),
      // Ability score
      ability: new fields.StringField({ required: false, initial: "int" }),
      // Can suffer from ACP
      acp: new fields.BooleanField({ required: false, initial: false }),
      // Requires training
      requiresTraining: new fields.BooleanField({ required: false, initial: false }),
      // Background skills optional rule org
      background: new fields.BooleanField({ required: false, initial: false }),
      // Explicitly custom skill
      custom: new fields.BooleanField({ required: false, initial: false }),
    };
  }

  /**
   * Is class skill?
   *
   * Status is pulled from actor.
   *
   * @type {boolean}
   */
  classSkill = false;

  /** @type {boolean} - Requires training alias */
  get rt() {
    return this.requiresTraining;
  }

  /** @type {boolean} - Class skill alias */
  get cs() {
    return this.classSkill;
  }
}
