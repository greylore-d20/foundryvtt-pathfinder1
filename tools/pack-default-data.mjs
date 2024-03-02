/**
 * Return the default data for an `ItemAction` component, akin to the template data used for documents like `Item` and `Actor`.
 *
 * @returns {object}}
 */
export function getActionDefaultData() {
  return {
    _id: "",
    name: "",
    img: "systems/pf1/icons/skills/gray_04.jpg",
    description: "",
    tag: "",
    activation: {
      cost: 1,
      type: "",
      unchained: {
        cost: 1,
        type: "",
      },
    },
    duration: {
      value: null,
      units: "",
      dismiss: false,
      concentration: false,
    },
    target: {
      value: "",
    },
    range: {
      value: null,
      units: "",
      maxIncrements: 1,
      minValue: null,
      minUnits: "",
    },
    uses: {
      autoDeductChargesCost: "",
      self: {
        value: 0,
        maxFormula: "",
        per: "",
      },
    },
    measureTemplate: {
      type: "",
      size: "",
      overrideColor: false,
      customColor: "",
      overrideTexture: false,
      customTexture: "",
    },
    attackName: "",
    actionType: "other",
    attackBonus: "",
    critConfirmBonus: "",
    damage: {
      parts: [],
      critParts: [],
      nonCritParts: [],
    },
    extraAttacks: {
      type: "",
      manual: [],
      formula: {
        count: "",
        bonus: "",
        label: "",
      },
    },
    formula: "",
    ability: {
      attack: "",
      damage: "",
      damageMult: 1,
      critRange: 20,
      critMult: 2,
    },
    save: {
      dc: "",
      type: "",
      description: "",
      harmless: false,
    },
    effectNotes: [],
    attackNotes: [],
    soundEffect: "",
    powerAttack: {
      multiplier: null,
      damageBonus: 2,
      critMultiplier: 1,
    },
    naturalAttack: {
      primaryAttack: true,
      secondary: {
        attackBonus: "-5",
        damageMult: 0.5,
      },
    },
    nonlethal: false,
    touch: false,
    usesAmmo: false,
    spellEffect: "",
    area: "",
    conditionals: [],
    enh: {
      value: null,
    },
    ammo: {
      type: "none",
      cost: 1,
    },
  };
}

/**
 * Return the default data for an `ItemChange` component, akin to the template data used for documents like `Item` and `Actor`.
 *
 * @returns {object}}
 */
export function getChangeDefaultData() {
  return {
    _id: "",
    formula: "",
    operator: "add",
    subTarget: "",
    modifier: "",
    priority: 0,
    flavor: undefined,
  };
}
