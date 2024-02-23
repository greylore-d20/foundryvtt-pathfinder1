import { ActionUse } from "../action-use/action-use.mjs";
import { RollPF } from "../dice/roll.mjs";

export class AttackDialog extends Application {
  /**
   * @param {pf1.components.ItemAction} action
   * @param {object} rollData
   * @param {object} shared
   * @param {object} appOptions
   */
  constructor(action, rollData = null, shared = {}, appOptions = {}) {
    super(appOptions);

    this.object = action;

    this.rollData = rollData ? rollData : action.getRollData();

    this.initAmmoUsage();
    this.initAttacks();

    this.base = {
      cl: this.rollData.cl ?? 0,
      sl: this.rollData.sl ?? 0,
    };

    const isNaturalAttack = action.item.subType === "natural",
      isPrimaryAttack = isNaturalAttack ? action.data.naturalAttack.primaryAttack !== false : true;

    this.flags = {
      "primary-attack": isPrimaryAttack,
      "cl-check": action.clCheck === true,
      "measure-template": true,
    };

    this.attributes = {
      d20: this.rollData.d20 ?? "",
      "attack-bonus": "",
      "damage-bonus": "",
      "cl-offset": "0",
      "sl-offset": "0",
      rollMode: shared.rollMode || game.settings.get("core", "rollMode"),
      "damage-ability-multiplier": this.damageMult,
      held: this.rollData.action?.held || this.rollData.item?.held || "normal",
    };

    this.conditionals = {};
    action.conditionals?.contents.forEach((conditional, idx) => {
      this.conditionals[`conditional.${idx}`] = conditional.data.default === true;
    });

    // Callback for AttackDialog.show()
    this._callbacks = {
      resolve: null,
      reject: null,
    };
  }

  get damageMult() {
    let damageMult = this.rollData.action?.ability?.damageMult ?? 1;

    const isPrimaryAttack = this.flags["primary-attack"];
    if (!isPrimaryAttack) {
      damageMult = this.rollData.action.naturalAttack?.secondary?.damageMult ?? 0.5;
    }

    return damageMult;
  }

  /** @type {pf1.components.ItemAction} */
  get action() {
    return this.object;
  }

  get title() {
    const action = this.action,
      item = action.item,
      actor = action.actor;

    if (actor) return `${action.name} (${item.name}) – ${actor.name}`;
    return `${action.name} (${item.name})`;
  }

  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      template: "systems/pf1/templates/apps/attack-roll-dialog.hbs",
      classes: ["pf1", "attack-dialog"],
      width: 440,
      height: "auto",
      closeOnSubmit: true,
      sheetConfig: false,
      submitOnChange: false,
      submitOnClose: false,
    };
  }

  static get defaultAttack() {
    return {
      label: "",
      attackBonus: 0,
      attackBonusTotal: 0,
      ammo: null,
    };
  }

  getData() {
    const action = this.action,
      item = action.item;

    return {
      data: this.rollData,
      item,
      action,
      config: pf1.config,
      rollMode: game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes,
      hasAttack: action.hasAttack,
      hasDamage: action.hasDamage,
      hasDamageAbility: action.data.ability?.damage ?? "" !== "",
      isNaturalAttack: item.system.subType === "natural",
      isWeaponAttack: item.system.subType === "weapon",
      isMeleeWeaponAttackAction: action.data.actionType === "mwak",
      isRangedWeaponAttackAction: ["rwak", "twak"].includes(action.data.actionType),
      isAttack: item.type === "attack",
      isWeapon: item.type === "weapon",
      isSpell: item.type === "spell",
      isFeat: item.type === "feat",
      isHealing: action.isHealing,
      hasTemplate: action.hasTemplate,
      attacks: this.attacks,
      flags: this.flags,
      attributes: this.attributes,
      conditionals: this.conditionals,
      usesAmmo: !!this.action.ammoType,
      ammo: this.getAmmo(),
    };
  }

  getAmmo() {
    const actor = this.action.actor;
    const ammoCost = this.action.ammoCost;
    const ammo = actor.itemTypes.loot.filter((item) => this._filterAmmo(item, ammoCost));

    return ammo.map((o) => {
      return {
        data: o.toObject(),
        isDefault: this.action.item.getFlag("pf1", "defaultAmmo") === o.id,
      };
    });
  }

  _filterAmmo(item, ammoCost = 1) {
    if (!(item.type === "loot" && item.subType === "ammo")) return false;
    if (item.system.quantity < ammoCost) return false;

    const ammoType = item.system.extraType;
    if (!ammoType) return true;

    return this.action.ammoType === ammoType;
  }

  activateListeners(html) {
    // Form changing
    html.find(`.flags input[type="checkbox"]`).on("change", this._onToggleFlag.bind(this));
    html.find(`input.attribute`).on("change", this._onChangeAttribute.bind(this));
    html.find(`input[type="checkbox"][name="concentration"]`).on("change", this._onToggleFlag.bind(this));
    html.find(`input[type="checkbox"][name="cl-check"]`).on("change", this._onToggleFlag.bind(this));
    html.find(`input[type="checkbox"][name="measure-template"]`).on("change", this._onToggleFlag.bind(this));
    html.find(`select`).on("change", this._onSelectChange.bind(this));
    html.find(`.conditionals input[type="checkbox"]`).on("change", this._onToggleConditional.bind(this));

    // Dropdown menu
    html.find(".ammo-select").on("click", this._onAmmoSelectClick.bind(this));
    html.find(".ammo-select .ammo-item .controls a").on("click", this._onAmmoControlClick.bind(this));
    html.find(".ammo-select .ammo-item").on("click", this._onAmmoClick.bind(this));
    html.on("click", this._unfocusElements.bind(this));

    // Button hover
    html.find(`button[name="attack_single"]`).on("mouseenter", this._hideExtraAttacks.bind(this));
    html.find(`button[name="attack_single"]`).on("mouseleave", this._showExtraAttacks.bind(this));

    // Button press
    html.find(`button[name="attack_single"]`).on("click", this._onAttackSingle.bind(this));
    html.find(`button[name="attack_full"]`).on("click", this._onAttackFull.bind(this));
  }

  _onSelectChange(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    this.attributes[elem.name] = elem.options[elem.selectedIndex].value;
    this.render();
  }

  _hideExtraAttacks(event) {
    const elems = this.element.find(".attacks .attack").filter((index, elem) => parseInt(elem.dataset.index) > 0);
    elems.addClass("disabled");
  }

  _showExtraAttacks(event) {
    this.element.find(".attacks .attack").removeClass("disabled");
  }

  _onToggleFlag(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    this.flags[elem.name] = elem.checked === true;

    // Add or remove haste, rapid-shot or manyshot attack
    switch (elem.name) {
      case "haste-attack":
      case "rapid-shot":
      case "manyshot": {
        if (elem.checked) {
          const translationString = {
            "haste-attack": "PF1.Haste",
            "rapid-shot": "PF1.RapidShot",
            manyshot: "PF1.Manyshot",
          };

          // Correlate manyshot with the first attack, add the others at the end
          const place = elem.name === "manyshot" ? 1 : this.attacks.length;

          this.attacks.splice(
            place,
            0,
            foundry.utils.mergeObject(this.constructor.defaultAttack, {
              id: elem.name,
              label: game.i18n.localize(translationString[elem.name]),
              attackBonusTotal: "", // Don't show anything in the mod field, as the data is not updated live
            })
          );
          this.setAttackAmmo(place, this.action.item.getFlag("pf1", "defaultAmmo"));
        } else {
          this.attacks = this.attacks.filter((o) => o.id !== elem.name);
        }
        break;
      }
      case "primary-attack":
        // Update damage mult to match primary/secondary default
        this.attributes["damage-ability-multiplier"] = this.damageMult;
        break;
    }

    this.render();
  }

  _onToggleConditional(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    this.conditionals[elem.name] = elem.checked === true;
    this.render();
  }

  _onAmmoSelectClick(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    const listElem = elem.querySelector("ul");

    // Filter to NOT act when clicking on the list child element
    if (!event.target.closest("ul")) {
      // Set classes for CSS
      listElem.classList.toggle("open");
      const isOpen = listElem.classList.contains("open");
      if (isOpen) elem.classList.add("focus");
      else elem.classList.remove("focus");
    }
  }

  _onAmmoClick(event) {
    const elem = event.target;
    // Don't do anything if this click was actually on its controls
    if (elem.closest(".controls") && !elem.classList.contains("controls")) return;

    event.preventDefault();
    const ammoId = elem.closest(".ammo-item").dataset.id;
    const attackIndex = parseInt(elem.closest(".attack").dataset.index);

    // Set ammo
    this.setAttackAmmo(attackIndex, ammoId === "null" ? null : ammoId);
    this.render();
  }

  async _onAmmoControlClick(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    const ammoId = elem.closest(".ammo-item").dataset.id;
    switch (elem.dataset.type) {
      case "set-default":
        if (ammoId === "null") await this.action.item.unsetFlag("pf1", "defaultAmmo");
        else await this.action.item.setFlag("pf1", "defaultAmmo", ammoId);
        // Apply CSS class, since we can't do a render in here and keep the dropdown menu open
        elem
          .closest("ul")
          .querySelectorAll(".ammo-item")
          .forEach((o) => o.classList.remove("default"));
        if (ammoId !== "null") elem.closest(".ammo-item").classList.add("default");
        break;
      case "set-all":
        for (let a = 0; a < this.attacks.length; a++) {
          this.setAttackAmmo(a, ammoId);
        }
        this.render();
    }
  }

  _unfocusElements(event) {
    // Close ammo select
    if (this.element[0].querySelector(".ammo-select") != null && !event.target.closest(".ammo-select")) {
      const elem = this.element[0].querySelector(".ammo-select");
      elem.classList.remove("focus");
      elem.querySelector("ul").classList.remove("open");
    }
  }

  _onChangeAttribute(event) {
    event.preventDefault();

    const elem = event.currentTarget;
    this.attributes[elem.name] = elem.value;

    // Also change roll data, if appropriate
    switch (elem.name) {
      case "cl-offset":
        this.rollData.cl = this.base.cl + parseInt(elem.value);
        break;
      case "sl-offset":
        this.rollData.sl = this.base.sl + parseInt(elem.value);
        break;
      case "damage-ability-multiplier":
        foundry.utils.setProperty(this.rollData, "item.ability.damageMult", elem.value);
        break;
      case "held":
        foundry.utils.setProperty(this.rollData, "item.held", elem.value);
        break;
    }

    this.render();
  }

  initAttacks() {
    const action = this.action,
      item = action.item;

    this.attacks = new ActionUse({ rollData: this.rollData, item, action })
      .generateAttacks(true)
      .map(({ label, attackBonus }) => ({
        label,
        attackBonus,
        // Reduce formula to a single number for easier display
        attackBonusTotal: RollPF.safeRoll(attackBonus, this.rollData).total ?? 0,
        // Ammo data is discarded in favour of specialised handling via setAttackAmmo
        ammo: null,
      }));

    // Set ammo usage
    const ammoId = item.getFlag("pf1", "defaultAmmo");
    if (ammoId != null) {
      for (let a = 0; a < this.attacks.length; a++) {
        this.setAttackAmmo(a, ammoId);
      }
    }
  }

  // Initializes ammo usage, which help avoid being able to overuse ammo
  initAmmoUsage() {
    this.ammoUsage = this.getAmmo().reduce((cur, o) => {
      cur[o.data._id] = {
        quantity: o.data.system.quantity,
        used: 0,
      };

      return cur;
    }, {});
  }

  getFormAttacks() {
    return this.attacks.map((o) => {
      return {
        id: o.id,
        label: o.label,
        attackBonus: o.attackBonus,
        ammo: o.ammo?.data._id,
      };
    });
  }

  setAttackAmmo(attackIndex, ammoId = null) {
    if (!this.action.ammoType) return;

    const atk = this.attacks[attackIndex];
    const curAmmo = atk.ammo?.data._id;
    const ammoItem = this.action.actor?.items.get(ammoId) ?? null;
    const abundant = ammoItem?.flags?.pf1?.abundant ?? false;

    // Check if ammo exists
    if (ammoId && this.ammoUsage[ammoId] == null) ammoId = null;

    if (!ammoId) {
      atk.ammo = null;
      // Remove from ammo usage tracker
      if (curAmmo != null) {
        this.ammoUsage[curAmmo].used--;
      }
      return;
    }

    // Don't allow overusage
    if (!abundant && this.ammoUsage[ammoId].used >= this.ammoUsage[ammoId].quantity) return;

    atk.ammo = this.getAmmo().find((o) => o.data._id === ammoId);
    // Add to ammo usage tracker
    if (curAmmo != null) {
      this.ammoUsage[curAmmo].used--;
    }
    this.ammoUsage[ammoId].used++;
  }

  _onAttackSingle(event) {
    event.preventDefault();

    const attacks = this.getFormAttacks();
    return this.doAttack(attacks.slice(0, 1), false);
  }

  _onAttackFull(event) {
    event.preventDefault();

    const attacks = this.getFormAttacks();
    return this.doAttack(attacks, true);
  }

  doAttack(attacks, fullAttack = true) {
    this._callbacks.resolve({ fullAttack, attacks, html: this.element });
    this._callbacks.resolve = null;
    this.close();
  }

  async close(options = {}) {
    this._callbacks.resolve?.(null);
    return super.close(options);
  }

  /**
   * @returns {Promise<object|null>} - Attack configuration object or null if rejected
   */
  show() {
    return new Promise((resolve, reject) => {
      this._callbacks.resolve = (...args) => {
        resolve(...args);
      };
      this._callbacks.reject = (...args) => {
        reject(...args);
      };
      this.render(true);
    });
  }
}
