/**
 * Return the default data for an `ItemAction` component, akin to the template data used for documents like `Item` and `Actor`.
 *
 * @returns {object}}
 */
export function getActionDefaultData() {
  return {
    _id: "",
    name: "",
    img: "",
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
      perAttack: false,
      self: {
        value: 0,
        maxFormula: "",
        per: "",
      },
    },
    measureTemplate: {
      type: "",
      size: "",
      color: "",
      texture: "",
    },
    attackName: "",
    actionType: "other",
    attackBonus: "",
    bab: "",
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
    ability: {
      attack: "",
      damage: "",
      max: null,
      damageMult: null,
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
    splash: false,
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
    alignments: {
      chaotic: null,
      evil: null,
      good: null,
      lawful: null,
    },
    material: {
      addon: [],
      normal: {
        custom: false,
        value: "",
      },
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
    target: "",
    type: "",
    priority: 0,
    flavor: undefined,
  };
}

export function getTokenDefaultData() {
  return {
    actorLink: false,
    disposition: -1,
    height: 1,
    width: 1,
    sight: {
      enabled: false,
    },
    texture: {
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      scaleY: 1,
      scaleX: 1,
      src: "",
    },
  };
}
