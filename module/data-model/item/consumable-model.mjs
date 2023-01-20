import {
  ActionModel,
  ChangeModel,
  ContextNoteModel,
  ChangeFlagsModel,
  TraitModel,
  ScriptCallModel,
  LinkDataModel,
} from "@model/common/_module.mjs";

import { IdentifierField, FormulaField } from "@model/fields/_module.mjs";

export class ConsumableItemModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      subType: new IdentifierField(),
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
      // Actions
      uses: new fields.SchemaField({
        autoDeductChargesCost: new FormulaField(),
        per: new IdentifierField({ blank: true, required: false }),
        maxFormula: new FormulaField(),
        pricePerUse: new fields.NumberField({ min: 0, required: false }),
        value: new fields.NumberField({ min: 0, integer: true, required: false }), // Uses left
      }),
      actions: new fields.ArrayField(new fields.EmbeddedDataField(ActionModel), { required: false }),
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
      showInQuickbar: new fields.BooleanField({ required: false }), // Default: false
      changes: new fields.ArrayField(new fields.EmbeddedDataField(ChangeModel), { required: false }),
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
          charges: new fields.ArrayField(new fields.EmbeddedDataField(LinkDataModel), { required: false }),
        },
        { required: false }
      ),
    };
  }
}
