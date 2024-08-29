import { Registry, RegistryEntry } from "./base-registry.mjs";

const fields = foundry.data.fields;

/**
 * A single material type entry in the {@link MaterialTypes} registry.
 *
 * @group Material Types
 */
export class MaterialType extends RegistryEntry {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      shortName: new fields.StringField({ required: false, initial: undefined, blank: false, localize: true }),
      treatedAs: new fields.StringField({ required: false, initial: undefined, blank: false }),
      addon: new fields.BooleanField({ required: false, initial: false }),
      intrinsic: new fields.BooleanField({ required: false, initial: false }), // Always available, same as base materials
      primitive: new fields.BooleanField({ required: false, initial: false }),
      baseMaterial: new fields.ArrayField(new fields.StringField(), { required: false, initial: [] }),
      hardness: new fields.NumberField({ required: false, initial: 10, integer: true, min: 0 }),
      hardnessMultiplier: new fields.NumberField({ required: false, initial: null, nullable: true, min: 0 }),
      healthPerInch: new fields.NumberField({ required: false, initial: null, integer: true, min: 0, nullable: true }),
      healthBonus: new fields.NumberField({ required: false, initial: 0, integer: true, min: 0 }),
      healthMultiplier: new fields.NumberField({ required: false, initial: 1.0, integer: false, positive: true }),
      masterwork: new fields.BooleanField({ required: false, initial: false }),
      allowed: new fields.SchemaField({
        lightBlade: new fields.BooleanField({ required: false, initial: true }),
        oneHandBlade: new fields.BooleanField({ required: false, initial: true }),
        twoHandBlade: new fields.BooleanField({ required: false, initial: true }),
        rangedWeapon: new fields.BooleanField({ required: false, initial: true }),
        buckler: new fields.BooleanField({ required: false, initial: true }),
        lightShield: new fields.BooleanField({ required: false, initial: true }),
        heavyShield: new fields.BooleanField({ required: false, initial: true }),
        towerShield: new fields.BooleanField({ required: false, initial: true }),
        lightArmor: new fields.BooleanField({ required: false, initial: true }),
        mediumArmor: new fields.BooleanField({ required: false, initial: true }),
        heavyArmor: new fields.BooleanField({ required: false, initial: true }),
      }),
      armor: new fields.SchemaField({
        acp: new fields.NumberField({ required: false, initial: 0, integer: true }),
        maxDex: new fields.NumberField({ required: false, initial: 0, integer: true }),
        asf: new fields.NumberField({ required: false, initial: 0, integer: true }),
      }),
      dr: new fields.BooleanField({ required: false, initial: false }),
      incompatible: new fields.ArrayField(new fields.StringField(), {
        required: false,
        initial: [],
      }),
      price: new fields.SchemaField({
        multiplier: new fields.NumberField({ required: false, initial: 1.0, integer: false, positive: true }),
        perPound: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        ammunition: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        lightWeapon: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        oneHandWeapon: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        twoHandWeapon: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        rangedOneHandWeapon: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        rangedTwoHandWeapon: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        shield: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        lightArmor: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        mediumArmor: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        heavyArmor: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
        enhancement: new fields.SchemaField({
          // Bonus cost to apply enhancement. One time price increase on first enhancement.
          weapon: new fields.NumberField({ required: false, initial: 0, min: 0 }),
        }),
      }),
      shield: new fields.SchemaField({
        acp: new fields.NumberField({ required: false, initial: 0, integer: true }),
        maxDex: new fields.NumberField({ required: false, initial: 0, integer: true }),
        asf: new fields.NumberField({ required: false, initial: 0, integer: true }),
      }),
      weight: new fields.SchemaField({
        multiplier: new fields.NumberField({ required: false, initial: 1.0, integer: false, positive: true }),
        bonusPerPound: new fields.NumberField({ required: false, initial: 0.0, integer: false, positive: false }),
      }),
    };
  }

  /**
   * Getter for whether this material is a basic material.
   *
   * @type {boolean}
   */
  get basic() {
    return !this.baseMaterial.length && !this.addon;
  }

  /**
   * Check if a given material is okay to be added to our materials list
   *
   * @param {ItemPF} item - Whether we're checking weapons or equipment
   * @returns {boolean} - Whether the material is allowed for the given item
   */
  isAllowed(item) {
    // Let's end this early if we can never be allowed
    if (this.basic) return false;
    const type = item.type,
      subtype = item.system.subType,
      baseMaterial = item.baseMaterial;
    let result = false;

    if (this.baseMaterial.length && baseMaterial && !this.baseMaterial.includes(baseMaterial)) {
      return result;
    }

    // Check whether the material is allowed for the given item
    switch (type) {
      case "spell": {
        result = true;
        break;
      }
      case "weapon":
      case "attack": {
        const weaponCategory = type === "weapon" ? item.system.weaponSubtype : item.system.weapon?.type || "all";

        switch (weaponCategory) {
          case "light":
            result = this.allowed.lightBlade;
            break;
          case "1h":
            result = this.allowed.oneHandBlade;
            break;
          case "2h":
            result = this.allowed.twoHandBlade;
            break;
          case "ranged":
            result = this.allowed.rangedWeapon;
            break;
          case "all": // We're prepping an Attack and don't care (don't have the info anyways)
            result =
              this.allowed.lightBlade ||
              this.allowed.oneHandBlade ||
              this.allowed.twoHandBlade ||
              this.allowed.rangedWeapon; // Essentially, filter out any that are armor-only.
            break;
          default:
            // Shouldn't find this
            return false;
        }
        break;
      }
      case "equipment": {
        if (subtype === "shield" && item.system.equipmentSubtype === "other") {
          result = this.allowed.buckler;
        } else {
          result = this.allowed[item.system.equipmentSubtype];
        }
        break;
      }
    }

    if (result && this.addon) {
      // If we're an addon, we need to check if the addon is valid for the item
      return this.isValidAddon(item) ?? false;
    }
    return result; // Finally made it through the gauntlet!
  }

  /**
   * Check if a given addon material is valid for the chosen material
   *
   * @param {ItemPF|MaterialType|string} material - Item, material, or material ID for which to test if this addon is valid.
   * @returns {boolean|null} - Null if the provided parameter is invalid, boolean otherwise.
   */
  isValidAddon(material) {
    // Convert item and material IDs to actual material
    if (material instanceof Item) material = pf1.registry.materialTypes.get(material.normalMaterial);
    else if (typeof material === "string") material = pf1.registry.materialTypes.get(material);

    if (!(material instanceof MaterialType)) {
      if (this.intrinsic) return true;
      return null; // Material not found or is invalid data
    }

    if (this.addon === material.addon) return false; // Both are addons or both are not addons

    return !this.incompatible.includes(material.id);
  }
}

/**
 * The singleton registry of material types.
 * At runtime this registry is accessible as `pf1.registry.materialTypes`.
 *
 * @group Material Types
 * @see {@link Registry}
 * @see {@link MaterialType}
 * @augments {Registry<MaterialType>}
 */
export class MaterialTypes extends Registry {
  /** @inheritdoc */
  static model = MaterialType;

  /** @inheritdoc */
  static _defaultData = [
    {
      _id: "cloth",
      name: "PF1.Materials.Types.Cloth",
      hardness: 0,
      healthPerInch: 2,
      healthMultiplier: 0.07,
    },
    {
      _id: "leather",
      name: "PF1.Materials.Types.Leather",
      hardness: 2,
      healthPerInch: 5,
      healthMultiplier: 0.17,
    },
    {
      _id: "adamantine",
      name: "PF1.Materials.Types.Adamantine",
      baseMaterial: ["steel"],
      hardness: 20,
      healthPerInch: 40,
      dr: true,
      masterwork: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      healthMultiplier: 1.34,
      price: {
        ammunition: 60.0,
        lightWeapon: 3000.0,
        oneHandWeapon: 3000.0,
        twoHandWeapon: 3000.0,
        rangedOneHandWeapon: 3000.0,
        rangedTwoHandWeapon: 3000.0,
        lightArmor: 5000.0,
        mediumArmor: 10000.0,
        heavyArmor: 15000.0,
      },
    },
    {
      _id: "alchemicalSilver",
      name: "PF1.Materials.Types.AlchemicalSilver",
      shortName: "PF1.Materials.Types.Silver",
      baseMaterial: ["steel"],
      hardness: 8,
      healthPerInch: 10,
      incompatible: ["adamantine", "coldIron", "mithral", "nexavaranSteel", "silversheen", "sunsilver"],
      dr: true,
      addon: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      healthMultiplier: 0.34,
      price: {
        ammunition: 2.0,
        lightWeapon: 20.0,
        oneHandWeapon: 90.0,
        twoHandWeapon: 180.0,
        rangedOneHandWeapon: 90.0,
        rangedTwoHandWeapon: 180.0,
      },
    },
    {
      _id: "angelSkin",
      name: "PF1.Materials.Types.AngelSkin",
      baseMaterial: ["leather"],
      hardness: 5,
      healthPerInch: 5,
      masterwork: true,
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        heavyArmor: false,
      },
      healthMultiplier: 0.17,
      price: {
        lightArmor: 1000.0,
        mediumArmor: 2000.0,
      },
    },
    {
      _id: "aszite",
      name: "PF1.Materials.Types.Aszite",
      addon: true,
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      price: {
        lightArmor: 750.0,
        mediumArmor: 750.0,
        heavyArmor: 1000.0,
      },
      weight: {
        multiplier: 1.1,
      },
    },
    {
      _id: "blackwood",
      name: "PF1.Materials.Types.Blackwood",
      baseMaterial: ["wood"],
      hardness: 7,
      healthPerInch: 10,
      masterwork: true,
      shield: {
        acp: -2,
      },
      price: {
        perPound: 20.0,
      },
      weight: {
        multiplier: 0.5,
      },
    },
    {
      _id: "blightQuartz",
      name: "PF1.Materials.Types.BlightQuartz",
      addon: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      price: {
        ammunition: 200.0,
        lightWeapon: 2500.0,
        oneHandWeapon: 2500.0,
        twoHandWeapon: 2500.0,
        rangedOneHandWeapon: 2500.0,
        rangedTwoHandWeapon: 2500.0,
      },
    },
    {
      _id: "bloodCrystal",
      name: "PF1.Materials.Types.BloodCrystal",
      baseMaterial: ["steel"],
      hardness: 10,
      healthPerInch: 10,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      healthMultiplier: 0.5,
      price: {
        ammunition: 30.0,
        lightWeapon: 1500.0,
        oneHandWeapon: 1500.0,
        twoHandWeapon: 1500.0,
        rangedOneHandWeapon: 1500.0,
        rangedTwoHandWeapon: 1500.0,
      },
    },
    {
      _id: "caphorite",
      name: "PF1.Materials.Types.Caphorite",
      baseMaterial: ["steel"],
      // No official hardness stat
      // No official hp per inch stat
      // Only allowed to be used for ammunition so these stats are not necessary
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      price: {
        ammunition: 10.0,
      },
    },
    {
      _id: "coldIron",
      name: "PF1.Materials.Types.ColdIron",
      baseMaterial: ["steel"],
      hardness: 10,
      healthPerInch: 30,
      dr: true,
      price: {
        multiplier: 2.0,
        enhancement: {
          weapon: 2_000,
        },
      },
    },
    {
      _id: "cryptstone",
      name: "PF1.Materials.Types.Cryptstone",
      baseMaterial: ["stone", "steel", "wood"],
      hardness: 10,
      healthPerInch: 30,
      masterwork: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      price: {
        ammunition: 10.0,
        lightWeapon: 500.0,
        oneHandWeapon: 500.0,
        twoHandWeapon: 500.0,
        rangedOneHandWeapon: 500.0,
        rangedTwoHandWeapon: 500.0,
      },
    },
    {
      _id: "darkleafCloth",
      name: "PF1.Materials.Types.DarkleafCloth",
      baseMaterial: ["leather", "cloth"],
      hardness: 10,
      healthPerInch: 20,
      masterwork: true,
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        heavyArmor: false,
      },
      armor: {
        acp: -3,
        maxDex: 2,
        asf: -10,
      },
      healthMultiplier: 4.0,
      price: {
        lightArmor: 750.0,
        mediumArmor: 1500.0,
      },
      weight: {
        multiplier: 0.5,
      },
    },
    {
      _id: "darkwood",
      name: "PF1.Materials.Types.Darkwood",
      baseMaterial: ["wood"],
      hardness: 5,
      healthPerInch: 10,
      masterwork: true,
      shield: {
        acp: -2,
      },
      price: {
        perPound: 10.0,
      },
      weight: {
        multiplier: 0.5,
      },
    },
    {
      _id: "dragonhide",
      name: "PF1.Materials.Types.Dragonhide",
      baseMaterial: ["leather"],
      hardness: 10,
      healthPerInch: 10, // Typically ½ and 1 inch thick
      masterwork: true,
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        buckler: false,
        towerShield: false,
      },
      price: {
        multiplier: 2.0,
      },
    },
    {
      _id: "druchite",
      name: "PF1.Materials.Types.Druchite",
      addon: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      healthMultiplier: 1.34,
      price: {
        ammunition: 12.0,
        lightWeapon: 1200.0,
        oneHandWeapon: 1200.0,
        twoHandWeapon: 1200.0,
        rangedOneHandWeapon: 1200.0,
        rangedTwoHandWeapon: 1200.0,
        lightArmor: 1000.0,
        mediumArmor: 1500.0,
        heavyArmor: 2000.0,
      },
    },
    {
      _id: "eelHide",
      name: "PF1.Materials.Types.EelHide",
      baseMaterial: ["leather"],
      hardness: 2,
      healthPerInch: 5,
      masterwork: true,
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        heavyArmor: false,
      },
      armor: {
        acp: -1,
        maxDex: 1,
      },
      price: {
        lightArmor: 1200.0,
        mediumArmor: 1800.0,
      },
    },
    {
      _id: "elysianBronze",
      name: "PF1.Materials.Types.ElysianBronze",
      baseMaterial: ["steel"],
      hardness: 10,
      healthPerInch: 30,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      price: {
        ammunition: 20.0,
        lightWeapon: 1000.0,
        oneHandWeapon: 1000.0,
        twoHandWeapon: 1000.0,
        rangedOneHandWeapon: 1000.0,
        rangedTwoHandWeapon: 1000.0,
        lightArmor: 1000.0,
        mediumArmor: 2000.0,
        heavyArmor: 3000.0,
      },
    },
    {
      _id: "fireForgedSteel",
      name: "PF1.Materials.Types.FireForgedSteel",
      baseMaterial: ["steel"],
      hardness: 10,
      healthPerInch: 30,
      masterwork: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      price: {
        ammunition: 15.0,
        lightWeapon: 600.0,
        oneHandWeapon: 600.0,
        twoHandWeapon: 600.0,
        rangedOneHandWeapon: 600.0,
        rangedTwoHandWeapon: 600.0,
        lightArmor: 1000.0,
        mediumArmor: 2500.0,
        heavyArmor: 3000.0,
      },
    },
    {
      _id: "frostForgedSteel",
      name: "PF1.Materials.Types.FrostForgedSteel",
      baseMaterial: ["steel"],
      hardness: 10,
      healthPerInch: 30,
      masterwork: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      price: {
        ammunition: 15.0,
        lightWeapon: 600.0,
        oneHandWeapon: 600.0,
        twoHandWeapon: 600.0,
        rangedOneHandWeapon: 600.0,
        rangedTwoHandWeapon: 600.0,
        lightArmor: 1000.0,
        mediumArmor: 2500.0,
        heavyArmor: 3000.0,
      },
    },
    {
      _id: "glaucite",
      name: "PF1.Materials.Types.Glaucite",
      baseMaterial: ["steel"],
      hardness: 15,
      healthPerInch: 30,
      allowed: {
        buckler: false,
      },
      price: {
        multiplier: 3.0,
      },
      weight: {
        multiplier: 1.5,
      },
    },
    {
      _id: "greenwood",
      name: "PF1.Materials.Types.Greenwood",
      baseMaterial: ["wood"],
      hardness: 5,
      healthPerInch: 10,
      masterwork: true,
      price: {
        perPound: 50.0,
        ammunition: 6.0,
        lightWeapon: 300.0,
        oneHandWeapon: 300.0,
        twoHandWeapon: 300.0,
        rangedOneHandWeapon: 300.0,
        rangedTwoHandWeapon: 300.0,
        shield: 150.0,
        lightArmor: 150.0,
        mediumArmor: 150.0,
        heavyArmor: 150.0,
      },
    },
    {
      _id: "griffonMane",
      name: "PF1.Materials.Types.GriffonMane",
      baseMaterial: ["cloth"],
      hardness: 1,
      healthPerInch: 4,
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      healthMultiplier: 2.0,
      price: {
        perPound: 50.0,
        lightArmor: 200.0,
      },
    },
    {
      _id: "heatstonePlating",
      name: "PF1.Materials.Types.HeatstonePlating",
      addon: true,
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        heavyArmor: false,
      },
      price: {
        lightArmor: 800.0,
        mediumArmor: 1000.0,
      },
      weight: {
        bonusPerPound: 0.2,
      },
    },
    {
      _id: "horacalcum",
      name: "PF1.Materials.Types.Horacalcum",
      baseMaterial: ["steel"],
      hardness: 15,
      healthPerInch: 30,
      masterwork: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      healthMultiplier: 1.25, // Horacalcum actually has additional multiplier over health per inch
      price: {
        ammunition: 120.0,
        lightWeapon: 6000.0,
        oneHandWeapon: 6000.0,
        twoHandWeapon: 6000.0,
        rangedOneHandWeapon: 6000.0,
        rangedTwoHandWeapon: 6000.0,
        lightArmor: 10000.0,
        mediumArmor: 30000.0,
        heavyArmor: 60000.0,
      },
    },
    {
      _id: "inubrix",
      name: "PF1.Materials.Types.Inubrix",
      baseMaterial: ["steel"],
      hardness: 5,
      healthPerInch: 10,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      healthMultiplier: 0.34,
      price: {
        ammunition: 100.0,
        lightWeapon: 5000.0,
        oneHandWeapon: 5000.0,
        twoHandWeapon: 5000.0,
        rangedOneHandWeapon: 5000.0,
        rangedTwoHandWeapon: 5000.0,
      },
    },
    /* This is added for completenss' sake, but it's not an applicable material outside of constructs.
    {
      _id: "irespanBasalt",
      name: "PF1.Materials.Types.IrespanBasalt",
      baseMaterial: ["stone"],
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      hardness: 10,
      price: {
        perPound: 0.5,
      },
    },
    */
    {
      _id: "lazurite",
      name: "PF1.Materials.Types.Lazurite",
      addon: true,
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      price: {
        lightArmor: 1500.0,
        mediumArmor: 2500.0,
        heavyArmor: 3500.0,
      },
    },
    {
      _id: "liquidGlass",
      name: "PF1.Materials.Types.LiquidGlass",
      baseMaterial: ["glass", "steel", "wood", "stone"], // BUG: Does not actually state base material
      hardness: 10,
      healthPerInch: 10,
      healthMultiplier: 0.34,
      price: {
        perPound: 250.0,
        ammunition: 16.0,
        lightWeapon: 800.0,
        oneHandWeapon: 800.0,
        twoHandWeapon: 800.0,
        rangedOneHandWeapon: 800.0,
        rangedTwoHandWeapon: 800.0,
      },
    },
    {
      _id: "livingSteel",
      name: "PF1.Materials.Types.LivingSteel",
      baseMaterial: ["steel"],
      hardness: 15,
      healthPerInch: 35,
      healthMultiplier: 1.16,
      price: {
        perPound: 250.0,
        ammunition: 10.0,
        lightWeapon: 500.0,
        oneHandWeapon: 500.0,
        twoHandWeapon: 500.0,
        rangedOneHandWeapon: 500.0,
        rangedTwoHandWeapon: 500.0,
        shield: 100.0,
        lightArmor: 500.0,
        mediumArmor: 1000.0,
        heavyArmor: 1500.0,
      },
    },
    {
      _id: "mithral",
      name: "PF1.Materials.Types.Mithral",
      baseMaterial: ["steel"],
      treatedAs: "alchemicalSilver",
      hardness: 15,
      healthPerInch: 30,
      masterwork: true,
      armor: {
        acp: 3,
        maxDex: 2,
        asf: -10,
      },
      shield: {
        acp: 3,
        maxDex: 2,
        asf: -10,
      },
      price: {
        perPound: 500, // Non-armor/shield only
        shield: 1000.0,
        lightArmor: 1000.0,
        mediumArmor: 4000.0,
        heavyArmor: 9000.0,
      },
      weight: {
        multiplier: 0.5,
      },
    },
    {
      _id: "nexavaranSteel",
      name: "PF1.Materials.Types.NexavaranSteel",
      baseMaterial: ["steel"],
      hardness: 10,
      healthPerInch: 30,
      dr: true,
      treatedAs: "coldIron",
      price: {
        multiplier: 1.5,
        enhancement: {
          weapon: 3_000,
        },
      },
    },
    {
      _id: "noqual",
      name: "PF1.Materials.Types.Noqual",
      baseMaterial: ["steel"],
      hardness: 10,
      healthPerInch: 30,
      armor: {
        acp: -3,
        maxDex: 2,
        asf: 20,
      },
      shield: {
        acp: -3,
        maxDex: 2,
        asf: 20,
      },
      price: {
        ammunition: 10.0,
        lightWeapon: 500.0,
        oneHandWeapon: 500.0,
        twoHandWeapon: 500.0,
        rangedOneHandWeapon: 500.0,
        rangedTwoHandWeapon: 500.0,
        shield: 2000.0,
        lightArmor: 4000.0,
        mediumArmor: 8000.0,
        heavyArmor: 12000.0,
      },
      weight: {
        multiplier: 0.5,
      },
    },
    {
      _id: "paueliel",
      name: "PF1.Materials.Types.Paueliel",
      baseMaterial: ["wood"],
      hardness: 7,
      healthPerInch: 10,
      masterwork: true,
      shield: {
        acp: -2,
      },
      price: {
        perPound: 15.0,
      },
      weight: {
        multiplier: 0.5,
      },
    },
    {
      _id: "pyresteel",
      name: "PF1.Materials.Types.PyreSteel",
      baseMaterial: ["steel"],
      hardness: 10,
      healthPerInch: 15,
      allowed: {
        buckler: false,
      },
      healthMultiplier: 0.5,
      price: {
        multiplier: 2.0,
      },
    },
    {
      _id: "siccatite",
      name: "PF1.Materials.Types.Siccatite",
      baseMaterial: ["steel"],
      hardness: 10, // Not officially statted
      healthPerInch: 30, // Not officially statted
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      price: {
        ammunition: 20.0,
        lightWeapon: 1000.0,
        oneHandWeapon: 1000.0,
        twoHandWeapon: 1000.0,
        rangedOneHandWeapon: 1000.0,
        rangedTwoHandWeapon: 1000.0,
        lightArmor: 6000.0,
        mediumArmor: 6000.0,
        heavyArmor: 6000.0,
      },
    },
    {
      _id: "silversheen",
      name: "PF1.Materials.Types.Silversheen",
      baseMaterial: ["steel"],
      treatedAs: "alchemicalSilver",
      hardness: 10, // Not officially statted
      healthPerInch: 30, // Not officially statted
      masterwork: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      price: {
        ammunition: 15.0,
        lightWeapon: 750.0,
        oneHandWeapon: 750.0,
        twoHandWeapon: 750.0,
        rangedOneHandWeapon: 750.0,
        rangedTwoHandWeapon: 750.0,
      },
    },
    {
      _id: "singingSteel",
      name: "PF1.Materials.Types.SingingSteel",
      baseMaterial: ["steel"],
      hardness: 10,
      healthPerInch: 20,
      masterwork: true,
      armor: {
        acp: -1,
        maxDex: 1,
        asf: -5,
      },
      shield: {
        acp: -1,
        maxDex: 1,
        asf: -5,
      },
      healthMultiplier: 0.67,
      price: {
        perPound: 600.0,
        ammunition: 120.0,
        lightWeapon: 6000.0,
        oneHandWeapon: 6000.0,
        twoHandWeapon: 6000.0,
        rangedOneHandWeapon: 6000.0,
        rangedTwoHandWeapon: 6000.0,
        shield: 7000.0,
        lightArmor: 750.0,
        mediumArmor: 9000.0,
        heavyArmor: 12000.0,
      },
    },
    {
      _id: "spireSteel",
      name: "PF1.Materials.Types.SpireSteel",
      baseMaterial: ["steel"],
      hardness: 10,
      healthPerInch: 30,
      masterwork: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      price: {
        ammunition: 10.0,
        lightWeapon: 2000.0,
        oneHandWeapon: 2000.0,
        twoHandWeapon: 2000.0,
        rangedOneHandWeapon: 2000.0,
        rangedTwoHandWeapon: 2000.0,
        lightArmor: 1000.0,
        mediumArmor: 2000.0,
        heavyArmor: 3000.0,
      },
    },
    {
      _id: "steel",
      name: "PF1.Materials.Types.Steel",
      hardness: 10,
      healthPerInch: 30,
    },
    {
      _id: "sunsilk",
      name: "PF1.Materials.Types.Sunsilk",
      addon: true,
      allowed: {
        lightBlade: false,
        oneHandBlade: false,
        twoHandBlade: false,
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
      },
      price: {
        lightArmor: 6000.0,
        mediumArmor: 6000.0,
        heavyArmor: 6000.0,
      },
    },
    {
      _id: "sunsilver",
      name: "PF1.Materials.Types.Sunsilver",
      baseMaterial: ["steel"],
      treatedAs: "alchemicalSilver",
      hardness: 8,
      healthPerInch: 10,
      masterwork: true,
      healthMultiplier: 0.34,
      price: {
        perPound: 25.0,
      },
    },
    {
      _id: "throneglass",
      name: "PF1.Materials.Types.Throneglass",
      baseMaterial: ["glass", "steel", "wood", "stone"], // BUG: Does not actually state base material
      hardness: 10, // "as durable as steel"
      healthPerInch: 30, // "as durable as steel"
      allowed: {
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      price: {
        lightWeapon: 13000.0,
        oneHandWeapon: 13000.0,
        twoHandWeapon: 13000.0,
      },
    },
    {
      _id: "viridium",
      name: "PF1.Materials.Types.Viridium",
      baseMaterial: ["steel"],
      hardness: 5,
      healthPerInch: 30, // Not officially statted
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      price: {
        ammunition: 20.0,
        lightWeapon: 200.0,
        oneHandWeapon: 200.0,
        twoHandWeapon: 200.0,
        rangedOneHandWeapon: 200.0,
        rangedTwoHandWeapon: 200.0,
      },
    },
    {
      _id: "voidglass",
      name: "PF1.Materials.Types.Voidglass",
      baseMaterial: ["glass", "steel"],
      hardness: 10,
      healthPerInch: 30,
      price: {
        lightWeapon: 1000.0,
        oneHandWeapon: 1000.0,
        twoHandWeapon: 1000.0,
        rangedOneHandWeapon: 1000.0,
        rangedTwoHandWeapon: 1000.0,
        shield: 3000.0,
        lightArmor: 1000.0,
        mediumArmor: 2000.0,
        heavyArmor: 4500.0,
      },
    },
    {
      _id: "whipwood",
      name: "PF1.Materials.Types.Whipwood",
      baseMaterial: ["wood"],
      hardness: 5,
      healthPerInch: 10,
      healthBonus: 5, // Grants flat +5 hp bonus to item regardless of anything else
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      price: {
        lightWeapon: 500.0,
        oneHandWeapon: 500.0,
        twoHandWeapon: 500.0,
        rangedOneHandWeapon: 500.0,
        rangedTwoHandWeapon: 500.0,
      },
    },
    {
      _id: "wyroot",
      name: "PF1.Materials.Types.Wyroot",
      baseMaterial: ["wood"],
      hardness: 5,
      healthPerInch: 10,
      allowed: {
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
    },
    {
      _id: "bone",
      name: "PF1.Materials.Types.Bone",
      primitive: true,
      hardness: 5, // Actually half of whatever the base material is for weapons, 5 is true for armor
      healthPerInch: null, // Same as base material
    },
    {
      _id: "bronze",
      name: "PF1.Materials.Types.Bronze",
      primitive: true,
      hardness: 9,
      healthPerInch: 30, // Not officially statted, but speaks of steel
      allowed: {
        buckler: false,
      },
    },
    {
      _id: "glass",
      name: "PF1.Materials.Types.Glass",
      primitive: true,
      hardnessMultiplier: 0.5,
      allowed: {
        buckler: false,
      },
    },
    {
      _id: "gold",
      name: "PF1.Materials.Types.Gold",
      primitive: true,
      hardnessMultiplier: 0.5,
      allowed: {
        buckler: false,
      },
      price: {
        multiplier: 10.0,
      },
      weight: {
        multiplier: 1.5,
      },
    },
    {
      _id: "obsidian",
      name: "PF1.Materials.Types.Obsidian",
      primitive: true,
      hardnessMultiplier: 0.5,
      allowed: {
        rangedWeapon: false,
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      price: {
        multiplier: 0.5,
      },
      weight: {
        multiplier: 0.75,
      },
    },
    {
      _id: "stone",
      name: "PF1.Materials.Types.Stone",
      primitive: true,
      hardnessMultiplier: 0.5,
      allowed: {
        buckler: false,
      },
      price: {
        multiplier: 0.25,
      },
      weight: {
        multiplier: 0.75,
      },
    },
    {
      _id: "wood",
      name: "PF1.Materials.Types.Wood",
      hardness: 5,
      healthPerInch: 10,
    },
    {
      _id: "magic",
      name: "PF1.Materials.Types.Magic",
      addon: true,
      intrinsic: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      dr: true,
    },
    {
      _id: "epic",
      name: "PF1.Materials.Types.Epic",
      addon: true,
      intrinsic: true,
      allowed: {
        buckler: false,
        lightShield: false,
        heavyShield: false,
        towerShield: false,
        lightArmor: false,
        mediumArmor: false,
        heavyArmor: false,
      },
      dr: true,
    },
  ];
}

/**
 * {@inheritDoc MaterialTypes}
 *
 * @group Material Types
 * @type {MaterialTypes}
 */
export let materialTypes;
