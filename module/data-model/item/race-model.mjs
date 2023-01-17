import {
  ChangeModel,
  ContextNoteModel,
  ChangeFlagsModel,
  TraitModel,
  ScriptCallModel,
  LinkDataModel,
} from "@model/common/_module.mjs";

import { IdentifierField } from "@model/fields/_module.mjs";

export class RaceItemModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.SchemaField(
        {
          value: new fields.StringField({ required: false }),
        },
        { required: false }
      ),
      // Physical details
      size: new fields.StringField({ initial: "med", required: false }),
      creatureType: new fields.StringField({ required: false }),
      subTypes: new fields.ArrayField(new fields.ArrayField(new fields.StringField()), { required: false }),
      // Common bits to most items
      classSkills: new fields.ObjectField({ required: false }), // TODO: Need better class skill field
      languages: new fields.EmbeddedDataField(TraitModel, { required: false }),
      weaponProf: new fields.EmbeddedDataField(TraitModel, { required: false }),
      armorProf: new fields.EmbeddedDataField(TraitModel, { required: false }),
      changes: new fields.ArrayField(new fields.EmbeddedDataField(ChangeModel)),
      changeFlags: new fields.EmbeddedDataField(ChangeFlagsModel, { required: false }),
      contextNotes: new fields.ArrayField(new fields.EmbeddedDataField(ContextNoteModel), { required: false }),
      flags: new fields.SchemaField(
        {
          boolean: new fields.ObjectField({ required: false }),
          dictionary: new fields.ObjectField({ required: false }),
        },
        { required: false }
      ),
      links: new fields.SchemaField(
        {
          children: new fields.ArrayField(new fields.EmbeddedDataField(LinkDataModel), { required: false }),
        },
        { required: false }
      ),
    };
  }
}
