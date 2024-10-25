import { CompactingMixin } from "@models/abstract/compacting-mixin.mjs";

export class DamagePartModel extends CompactingMixin(foundry.abstract.DataModel) {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      formula: new fields.StringField(),
      types: new fields.SetField(new fields.StringField({ blank: false, nullable: false })),
    };
  }

  static migrateData(source) {
    // Merge standard and custom type IDs into single array.
    if (!source.types && source.type) {
      source.types = source.type?.values ?? [];

      if (typeof source.type?.custom === "string" && source.type.custom.length) {
        source.types.push(source.type.custom.split(";").map((t) => t.trim()));
      }
    }

    return super.migrateData(source);
  }

  _initialize(options) {
    super._initialize(options);

    Object.defineProperty(this, "type", {
      get() {
        foundry.utils.logCompatibilityWarning("DamagePartModel.type is deprecated in favor of DamagePartModel.types", {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        });

        const full = this.fullTypes;
        return {
          values: [...full.standard].map((d) => d.id),
          custom: [...full.custom].join(";"),
        };
      },
    });
  }

  /**
   * Prune data
   *
   * @param {object} data
   */
  static pruneData(data) {
    if (!data.formula) delete data.formula;
    if (!data.types?.length) delete data.types;
  }

  /** @type {{standard:Set<pf1.registry.DamageType>,custom:Set<string>}} - Full types */
  get allTypes() {
    const result = {
      standard: new Set(),
      custom: new Set(),
      get all() {
        return [...this.standard, ...this.custom];
      },
    };
    for (const type of this.types) {
      const d = pf1.registry.damageTypes.get(type);
      if (d) {
        result.standard.add(d);
      } else {
        result.custom.add(type);
      }
    }
    return result;
  }

  /** @type {Set<pf1.registry.DamageType>} */
  get standard() {
    return this.allTypes.standard;
  }

  /** @type {Set<string>} - Custom types */
  get custom() {
    return this.allTypes.custom;
  }
}
