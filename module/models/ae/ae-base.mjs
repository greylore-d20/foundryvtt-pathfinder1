/**
 * Base model for Active Effects
 */
export class AEBase extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      // End timing
      end: new fields.StringField({
        required: false,
        blank: false,
        initial: undefined,
        choices: () => pf1.config.durationEndEvents,
        label: "PF1.DurationEndTiming",
      }),
      // Initiative this AE was started on
      initiative: new fields.NumberField({
        initial: undefined,
        required: false,
        nullable: false,
        label: "PF1.Initiative",
      }),
      // Arbitrary level
      level: new fields.NumberField({
        integer: true,
        initial: undefined,
        required: false,
        nullable: false,
        label: "PF1.Level",
      }),
    };
  }
}
