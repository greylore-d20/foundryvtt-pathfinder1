import { ActionUse, ActionUseAttack } from "../action-use/action-use.mjs";
import { RollPF } from "../dice/roll.mjs";

export class AttackDialog extends Application {
  /**
   * @param {pf1.actionUse.ActionUse} actionUse
   * @param {object} appOptions
   */
  constructor(actionUse, appOptions = {}) {
    super(appOptions);

    this.actionUse = actionUse;
    this.object = actionUse.action;

    const action = actionUse.action;
    const item = actionUse.item;
    const shared = actionUse.shared;
    this.shared = shared;

    this.useOptions = shared.useOptions ?? {};

    this.rollData = shared.rollData;

    this.initAmmoUsage();
    this.initAttacks();

    this.base = {
      cl: this.rollData.cl ?? 0,
      sl: this.rollData.sl ?? 0,
    };

    const isNaturalAttack = action.item.subType === "natural",
      isPrimaryAttack = isNaturalAttack ? action.data.naturalAttack.primaryAttack !== false : true;

    const useOptions = this.useOptions;

    this.flags = {
      "power-attack": useOptions.powerAttack ?? false,
      "primary-attack": useOptions.primaryAttack ?? isPrimaryAttack,
      "cl-check": useOptions.clCheck ?? item?.system.clCheck === true,
      "measure-template": useOptions.measureTemplate ?? true,
      "haste-attack": useOptions.haste,
      manyshot: useOptions.manyshot,
      "rapid-shot": useOptions.rapidShot,
    };

    let damageMult = this.damageMult;
    if (useOptions.abilityMult != null) damageMult = useOptions.abilityMult;

    this.attributes = {
      d20: this.rollData.d20 ?? "",
      "attack-bonus": "",
      "damage-bonus": "",
      "cl-offset": "0",
      "sl-offset": "0",
      rollMode: shared.rollMode || game.settings.get("core", "rollMode"),
      "damage-ability-multiplier": damageMult,
      held: useOptions.held || this.rollData.action?.held || this.rollData.item?.held || "normal",
    };

    this.conditionals = {};
    action.conditionals?.contents.forEach((conditional, idx) => {
      this.conditionals[`conditional.${idx}`] = conditional.data.default === true;
    });

    if (useOptions.haste) this._toggleExtraAttack("haste-attack", true);
    if (useOptions.manyshot) this._toggleExtraAttack("manyshot", true);
    if (useOptions.rapidShot) this._toggleExtraAttack("rapid-shot", true);

    // Callback for AttackDialog.show()
    this.resolve = null;
  }

  get damageMult() {
    const rollData = this.rollData;
    const held = rollData.action?.held || rollData.item?.held || "1h";
    let damageMult = rollData.action?.ability?.damageMult ?? pf1.config.abilityDamageHeldMultipliers[held] ?? 1;

    const isPrimaryAttack = this.flags["primary-attack"];
    if (!isPrimaryAttack) {
      damageMult = rollData.action.naturalAttack?.secondary?.damageMult ?? 0.5;
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

  getData() {
    const action = this.action,
      item = action.item;

    const context = {
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
      isRanged: action.isRanged,
      isMeleeWeaponAttackAction: action.data.actionType === "mwak",
      isRangedWeaponAttackAction: action.isRanged && !action.isCombatManeuver,
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
      ammo: this.actionUse.getAmmo(),
    };

    // Determine if power attack mode should be displayed
    context.canConfigureHeld =
      context.flags["power-attack"] &&
      !context.isRanged &&
      (context.isAttack || context.isWeapon) &&
      !context.isNaturalAttack;

    if (!Number.isFinite(action.data.ability?.damageMult)) {
      context.canConfigureHeld = true;
    }

    return context;
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
    html.find(`button[name="attack_single"]`).on("pointerenter", this._hideExtraAttacks.bind(this));
    html.find(`button[name="attack_single"]`).on("pointerleave", this._showExtraAttacks.bind(this));

    // Button press
    html.find(`button[name="attack_single"]`).on("click", (ev) => this.resolveAttack(ev, false));
    html.find(`button[name="attack_full"]`).on("click", (ev) => this.resolveAttack(ev, true));
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

  /**
   * @internal
   * @param {object} [options] - Additional options
   * @param {boolean} [options.render=true] - Call render
   * @param {Event} event
   */
  _onToggleFlag(event) {
    if (event?.cancelable) event.preventDefault();

    const elem = event.currentTarget;
    this.flags[elem.name] = elem.checked === true;

    // Add or remove haste, rapid-shot or manyshot attack
    switch (elem.name) {
      case "haste-attack":
      case "rapid-shot":
      case "manyshot": {
        this._toggleExtraAttack(elem.name, elem.checked);
        break;
      }
      case "primary-attack":
        // Update damage mult to match primary/secondary default
        this.attributes["damage-ability-multiplier"] = this.damageMult;
        break;
    }

    this.render();
  }

  _toggleExtraAttack(type, enabled = true) {
    if (enabled) {
      const translationString = {
        "haste-attack": "PF1.Haste",
        "rapid-shot": "PF1.RapidShot",
        manyshot: "PF1.Manyshot",
      };

      // Correlate manyshot with the first attack, add the others at the end
      const place = type === "manyshot" ? 1 : this.attacks.length;

      this.attacks.splice(
        place,
        0,
        new ActionUseAttack(game.i18n.localize(translationString[type]), "", null, { abstract: true, type })
      );
      this.setAttackAmmo(place, this.action.item.getFlag("pf1", "defaultAmmo"));
    } else {
      this.attacks.findSplice((o) => o.type === type);
    }
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
        foundry.utils.setProperty(this.rollData, "action.ability.damageMult", elem.value);
        break;
      case "held":
        foundry.utils.setProperty(this.rollData, "action.held", elem.value);
        break;
    }

    this.render();
  }

  initAttacks() {
    this.attacks = this.shared.attacks;

    for (const atk of this.attacks) {
      atk.attackBonusTotal = RollPF.safeRollAsync(atk.attackBonus, this.rollData).total ?? 0;
    }

    // Set ammo usage
    if (this.action.ammoType) {
      const ammoId = this.action.item.getFlag("pf1", "defaultAmmo");
      if (ammoId != null) {
        for (let a = 0; a < this.attacks.length; a++) {
          this.setAttackAmmo(a, ammoId);
        }
      }
    }
  }

  // Initializes ammo usage, which helps avoid being able to overuse ammo
  initAmmoUsage() {
    this.ammoUsage = this.actionUse.getAmmo().reduce((cur, o) => {
      cur[o.id] = {
        quantity: o.quantity,
        used: 0,
      };

      return cur;
    }, {});
  }

  setAttackAmmo(attackIndex, ammoId = null) {
    if (!this.action.ammoType) return;

    const atk = this.attacks[attackIndex];
    const curAmmo = atk.ammo?.id;
    const ammoItem = this.action.actor?.items.get(ammoId) ?? null;
    const abundant = ammoItem?.system.abundant ?? false;

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

    atk.ammo = this.actionUse.getAmmo().find((o) => o.id === ammoId);

    // Add to ammo usage tracker
    if (curAmmo) this.ammoUsage[curAmmo].used--;
    this.ammoUsage[ammoId].used++;
  }

  /**
   * @internal
   * @param {Event} event
   * @param {boolean} fullAttack
   */
  resolveAttack(event, fullAttack = true) {
    event.preventDefault();

    const form = new FormDataExtended(this.element.find("form")[0]).object;
    form.fullAttack = fullAttack;

    this.resolve(form);
    this.close();
  }

  async close(options = {}) {
    this.resolve(null);
    return super.close(options);
  }

  /**
   * @returns {Promise<object|null>} - Attack configuration object or null if rejected
   */
  show() {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.render(true);
    });
  }
}
