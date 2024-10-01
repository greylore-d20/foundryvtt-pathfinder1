import {
  ChangeModel,
  ContextNoteModel,
  ChangeFlagsModel,
  TraitModel,
  ScriptCallModel,
  LinkDataModel,
} from "@model/common/_module.mjs";

import { IdentifierField, FormulaField } from "@model/fields/_module.mjs";

export class ClassItemModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      subType: new IdentifierField({ initial: "base" }),
      description: new fields.SchemaField(
        {
          value: new fields.HTMLField({ required: false }),
        },
        { required: false }
      ),
      level: new fields.NumberField({ integer: true, min: 0, initial: 1, required: false }),
      hp: new fields.NumberField({ integer: true, min: 0, required: false }), // Hit points from class, unneeded with auto hit points
      hd: new fields.NumberField({ integer: true, min: 0, initial: 6, required: false }), // Hit Die size
      customHD: new FormulaField(),
      bab: new IdentifierField({ strict: true, required: false }),
      babFormula: new FormulaField(),
      skillsPerLevel: new fields.NumberField({ integer: true, initial: 2, min: 0, required: false }),
      savingThrows: new fields.SchemaField(
        {
          fort: new fields.SchemaField(
            {
              value: new IdentifierField({ strict: true, required: false }),
              custom: new FormulaField(),
            },
            { required: false }
          ),
          ref: new fields.SchemaField(
            {
              value: new IdentifierField({ strict: true, required: false }),
              custom: new FormulaField(),
            },
            { required: false }
          ),
          will: new fields.SchemaField(
            {
              value: new IdentifierField({ strict: true, required: false }),
              custom: new FormulaField(),
            },
            { required: false }
          ),
        },
        { required: false }
      ),
      fc: new fields.SchemaField(
        {
          alt: new fields.SchemaField(
            {
              value: new fields.NumberField({ min: 0, integer: true, required: false }), // Default: undefined
              notes: new fields.StringField(),
            },
            { required: false }
          ),
          hp: new fields.SchemaField(
            {
              value: new fields.NumberField({ min: 0, integer: true, required: false }), // Default: undefined
            },
            { required: false }
          ),
          skill: new fields.SchemaField(
            {
              value: new fields.NumberField({ min: 0, integer: true, required: false }), // Default: undefined
            },
            { required: false }
          ),
        },
        { required: false }
      ),
      // Common bits to most items
      classSkills: new fields.ObjectField({ required: false }), // TODO: Need better class skill field
      languages: new fields.EmbeddedDataField(TraitModel, { required: false }),
      weaponProf: new fields.EmbeddedDataField(TraitModel, { required: false }),
      armorProf: new fields.EmbeddedDataField(TraitModel, { required: false }),
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
      tag: new IdentifierField({ required: false, blank: true, nullable: true }),
      useCustomTag: new fields.BooleanField({ required: false }), // Default: false
      links: new fields.SchemaField(
        {
          children: new fields.ArrayField(new fields.EmbeddedDataField(LinkDataModel), { required: false }),
          classAssociations: new fields.ArrayField(new fields.EmbeddedDataField(LinkDataModel), { required: false }),
        },
        { required: false }
      ),
    };
  }
}
