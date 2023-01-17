import {
  ChangeModel,
  ContextNoteModel,
  ChangeFlagsModel,
  TraitModel,
  ScriptCallModel,
  LinkDataModel,
} from "@model/common/_module.mjs";

import { IdentifierField } from "@model/fields/_module.mjs";

export class LootItemModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      subType: new fields.StringField({ required: true }),
      extraType: new fields.StringField({ required: true }),
      description: new fields.SchemaField(
        {
          value: new fields.HTMLField({ required: false }),
          unidentified: new fields.HTMLField({ required: false }),
        },
        { required: false }
      ),
      unidentified: new fields.SchemaField(
        {
          name: new fields.StringField({ blank: true, required: false }),
          price: new fields.NumberField({ min: 0, required: false }),
        },
        { required: false }
      ),
      // Physical details
      quantity: new fields.NumberField({ initial: 1, min: 0 }),
      size: new fields.StringField({ initial: "med", required: false }),
      carried: new fields.BooleanField({ required: false }),
      broken: new fields.BooleanField({ required: false }),
      price: new fields.NumberField({ initial: 0, min: 0, required: false }),
      hp: new fields.SchemaField(
        {
          value: new fields.NumberField({ initial: 10, min: 0, required: false }),
          max: new fields.NumberField({ initial: 10, min: 0, required: false }),
        },
        { required: false }
      ),
      hardness: new fields.NumberField({ initial: 0, min: 0, integer: true, required: false }),
      weight: new fields.SchemaField(
        {
          value: new fields.NumberField({ initial: 0, min: 0, required: false }),
        },
        { required: false }
      ),
      // Magic item details
      identified: new fields.BooleanField({ required: false }),
      cl: new fields.NumberField({ min: 0, integer: true, required: false }),
      aura: new fields.SchemaField(
        {
          school: new fields.StringField({ blank: true, required: false }),
          custom: new fields.BooleanField({ required: false }),
        },
        { required: false }
      ),
      resizing: new fields.BooleanField({ required: false }),
      // Common bits to most items
      changes: new fields.ArrayField(new fields.EmbeddedDataField(ChangeModel)),
      changeFlags: new fields.EmbeddedDataField(ChangeFlagsModel, { required: false }),
      scriptCalls: new fields.ArrayField(new fields.EmbeddedDataField(ScriptCallModel), { required: false }),
      contextNotes: new fields.ArrayField(new fields.EmbeddedDataField(ContextNoteModel), { required: false }),
      flags: new fields.SchemaField(
        {
          boolean: new fields.ObjectField({ required: false }),
          dictionary: new fields.ObjectField({ required: false }),
        },
        { required: false }
      ),
      tag: new fields.StringField({ required: false, blank: true }),
      useCustomTag: new fields.BooleanField({ required: false }),
      links: new fields.SchemaField(
        {
          children: new fields.ArrayField(new fields.EmbeddedDataField(LinkDataModel), { required: false }),
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
