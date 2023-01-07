import { ChangeModel, ContextNoteModel, ChangeFlagsModel, TraitModel, ScriptCallModel } from "../common/_module.mjs";

export class BuffItemModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      buffType: new fields.StringField({ required: true }),

      active: new fields.BooleanField({ required: false, initial: false }),
      level: new fields.NumberField({ required: false, nullable: true }),
      hideFromToken: new fields.BooleanField({ required: false }),
      duration: new fields.SchemaField(
        {
          start: new fields.NumberField({ required: false, integer: true }),
          units: new fields.StringField({ required: false, blank: true }),
          value: new fields.StringField({ required: false, blank: true, nullable: true }),
        },
        { required: false }
      ),
      changes: new fields.ArrayField(new fields.EmbeddedDataField(ChangeModel)),
      changeFlags: new fields.EmbeddedDataField(ChangeFlagsModel, { required: false }),
      scriptCalls: new fields.ArrayField(new fields.EmbeddedDataField(ScriptCallModel), { required: false }),
      contextNotes: new fields.ArrayField(new fields.EmbeddedDataField(ContextNoteModel), { required: false }),
      description: new fields.SchemaField(
        {
          value: new fields.StringField({ required: false }),
        },
        { required: false }
      ),
      flags: new fields.SchemaField({
        boolean: new fields.ObjectField({ required: false }),
        dictionary: new fields.ObjectField({ required: false }),
      }),
      languages: new fields.EmbeddedDataField(TraitModel, { required: false }),
      weaponProf: new fields.EmbeddedDataField(TraitModel, { required: false }),
      armorProf: new fields.EmbeddedDataField(TraitModel, { required: false }),
      tag: new fields.StringField({ required: false, blank: true }),
      useCustomTag: new fields.BooleanField({ required: false }),
      links: new fields.SchemaField(
        {
          children: new fields.ArrayField(new fields.ObjectField(), { required: false }),
        },
        { required: false }
      ),
    };
  }

  // Migrates only in-memory, should be replaced with proper migration
  static migrateData(source) {
    super.migrateData(source);
    if (typeof source.level === "string") {
      if (source.level.length) source.level = parseInt(source.level);
      else source.level = null;
    }
  }
}
