import { IdentifierField, FormulaField } from "@model/fields/_module.mjs";
import { ConditionalModel } from "./conditional.mjs";
import { DamageModel } from "./damage-model.mjs";

/**
 * ItemAction data model
 */
export class ActionModel extends foundry.abstract.DataModel {
  static _enableV10Validation = true; // TODO: Remove with Foundry v11 where this becomes the standard

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      _id: new IdentifierField({ strict: true }),
      name: new fields.StringField({ required: true, blank: false, nullable: false }),
      img: new fields.StringField({ required: false, blank: false, nullable: false }),
      description: new fields.StringField({ blank: true, initial: "", required: false }),
      tag: new fields.IdentifierField({ strict: true, initial: "", blank: true, required: false }),
      activation: new fields.SchemaField(
        {
          cost: fields.NumberField({ integer: true }),
          type: fields.StringField({ required: false, blank: true }),
        },
        { required: false, initial: () => ({ cost: 1 }) }
      ),
      unchainedAction: new fields.SchemaField(
        {
          activation: new fields.SchemaField(
            {
              cost: fields.NumberField({ integer: true }),
              type: fields.StringField({ required: false, blank: true }),
            },
            { required: false, initial: () => ({ activation: { cost: 1 } }) }
          ),
        },
        { required: false, initial: () => ({ activation: { cost: 1 } }) }
      ),
      duration: new fields.SchemaField(
        {
          value: new FormulaField(),
          units: new fields.StringField({ blank: true, required: false }),
        },
        { required: false }
      ),
      target: new fields.SchemaField(
        {
          value: new fields.StringField({ blank: true }),
        },
        { required: false }
      ),
      range: new fields.SchemaField(
        {
          value: new FormulaField(),
          units: new fields.StringField({ blank: true, initial: "", required: false }),
          maxIncrements: new fields.NumberField({ min: 0, integer: true, initial: 1, required: false }),
          minValue: new FormulaField(),
          minUnits: new fields.StringField({ blank: true, initial: "", required: false }),
        },
        { required: false }
      ),
      uses: new fields.SchemaField({
        autoDeductChargesCost: new FormulaField(),
        self: new fields.SchemaField(
          {
            value: new fields.NumberField({ min: 0, integer: true }),
            maxFormula: new FormulaField(),
            per: new fields.StringField({ required: false }),
          },
          { required: false }
        ),
      }),
      measureTemplate: new fields.SchemaField(
        {
          type: new fields.StringField({ required: false }),
          size: new FormulaField(),
          overrideColor: new fields.BooleanField({ required: false }),
          customColor: new fields.ColorField({ blank: true, required: false }),
          overrideTexture: new fields.BooleanField({ required: false }),
          customTexture: new fields.FilePathField({ blank: true, required: false, categories: ["IMAGE", "VIDEO"] }),
        },
        { required: false }
      ),
      attackName: new fields.StringField({ required: false }),
      actionType: new fields.StringField({ required: false }),
      attackBonus: new FormulaField(),
      critConfirmBonus: new FormulaField(),
      damage: new fields.SchemaField(
        {
          parts: new fields.ArrayFields(new fields.EmbeddedDataField(DamageModel), { required: false }),
          critParts: new fields.ArrayFields(new fields.EmbeddedDataField(DamageModel), { required: false }),
          nonCritParts: new fields.ArrayFields(new fields.EmbeddedDataField(DamageModel), { required: false }),
        },
        { required: false }
      ),
      attackParts: [], // TODO
      formulaicAttacks: new fields.SchemaField(
        {
          count: new fields.SchemaField({ formula: new FormulaField() }),
          bonus: new fields.SchemaField({ formula: new FormulaField() }),
          label: new fields.StringField({ required: false }),
        },
        { required: false }
      ),
      ability: new fields.SchemaField(
        {
          attack: new fields.StringField({ required: false }), // Default: "str"
          damage: new fields.StringField({ required: false }), // Default: "str"
          damageMult: new fields.NumberField({ positive: true, required: false }), // Default: 1
          critRange: new fields.NumberField({ integer: true, min: 1, max: 20, required: false }), // Default: 20
          critMult: new fields.NumberField({ integer: true, positive: true, min: 1, required: false }), // Default: 2
        },
        { required: false }
      ),
      save: new fields.SchemaField(
        {
          dc: new FormulaField(),
          type: new IdentifierField({ strict: true }),
          description: "",
        },
        { required: false }
      ),
      effectNotes: new fields.ArrayField(new fields.StringField({ blank: true }), { required: false }),
      attackNotes: new fields.ArrayField(new fields.StringField({ blank: true }), { required: false }),
      soundEffect: new fields.FilePathField({ blank: true, required: false, categories: ["AUDIO"] }),
      powerAttack: new fields.SchemaField(
        {
          multiplier: new fields.NumberField({ positive: true, required: false }), // Default inherit from Held
          damageBonus: new fields.NumberField({ positive: true, required: false }), // Default: 2
          critMultiplier: new fields.NumberField({ min: 0, integer: true, required: false }), // Default: 1
        },
        { required: false }
      ),
      naturalAttack: new fields.SchemaField(
        {
          primaryAttack: new fields.BooleanField({ required: false }), // Default: true
          secondary: new fields.SchemaField(
            {
              attackBonus: new FormulaField(), // Default: "-5"
              damageMult: new fields.NumberField({ required: false }), // Default: 0.5
            },
            { required: false }
          ),
        },
        { required: false }
      ),
      nonlethal: new fields.BooleanField({ required: false }), // Default: false
      usesAmmo: new fields.BooleanField({ required: false }), // Default: false
      spellEffect: new fields.StringField({ required: false }),
      spellArea: new fields.StringField({ required: false }),
      conditionals: new fields.ArrayFields(new fields.EmbeddedDataField(ConditionalModel), { required: false }),
      enh: new fields.SchemaField(
        {
          value: new fields.NumberField({ required: false, min: 0, nullable: true }), // Default: undefined
        },
        { required: false }
      ),
    };
  }

  get id() {
    return this._id;
  }
}
