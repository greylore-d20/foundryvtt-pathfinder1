/**
 * @property {string} text - Note contents
 * @property {string} subTaget - Note subject
 */
export class ContextNote extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      text: new fields.StringField({ initial: "", nullable: false, blank: true }),
      target: new fields.StringField({ initial: "", nullable: false, blank: true }),
    };
  }

  get subTarget() {
    foundry.utils.logCompatibilityWarning("ContextNote.subTarget is deprecated in favor of ContextNote.target", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });

    return this.target;
  }

  static migrateData(source) {
    if (source.subTarget) {
      // Transfer a special tuple format target
      if (source.target === "spell" && source.subTarget === "effect") {
        source.target = "spellEffect";
      }
      // Otherwise transfer subtarget to target
      else {
        source.target = source.subTarget;
      }
    }
  }
}
