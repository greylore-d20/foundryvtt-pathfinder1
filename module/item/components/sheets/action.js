export class ItemActionSheet extends FormApplication {
  constructor(...args) {
    super(...args);

    this.item.apps[this.appId] = this;
    this.action.apps[this.appId] = this;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/apps/item-action.hbs",
      width: 580,
      height: 720,
      closeOnSubmit: false,
      submitOnClose: true,
      submitOnChange: true,
      resizable: true,
      scrollY: [".tab"],
      tabs: [
        {
          navSelector: "nav.tabs[data-group='primary']",
          contentSelector: "section.primary-body",
          initial: "description",
        },
      ],
    });
  }

  get action() {
    return this.object;
  }
  get item() {
    return this.action.item;
  }
  get actor() {
    return this.item.parentActor;
  }

  async getData() {
    const data = await super.getData();
    data.action = this.action;
    data.item = this.item;
    data.actor = this.actor;
    data.data = this.action.data;

    // Include CONFIG values
    data.config = CONFIG.PF1;

    // Action Details
    data.hasAttackRoll = this.action.hasAttack;
    data.isHealing = data.data.actionType === "heal";
    data.isCombatManeuver = ["mcman", "rcman"].includes(data.data.actionType);

    data.isCharged = this.action.isCharged;
    if (this.action.hasRange) {
      data.canInputRange = ["ft", "mi", "spec"].includes(data.data.range.units);
      data.canInputMinRange = ["ft", "mi", "spec"].includes(data.data.range.minUnits);
    }
    if (data.data.duration != null) {
      data.canInputDuration = !["", "inst", "perm", "seeText"].includes(data.data.duration.units);
    }

    // Action Details
    data.itemName = data.item.name;
    data.isSpell = this.item.type === "spell";
    data.canUseAmmo = this.item.data.data.usesAmmo !== undefined;
    data.owned = this.item.actor != null;
    data.parentOwned = this.actor != null;
    data.owner = this.item.isOwner;
    data.isGM = game.user.isGM;
    data.unchainedActionEconomy = game.settings.get("pf1", "unchainedActionEconomy");
    data.hasActivationType =
      (game.settings.get("pf1", "unchainedActionEconomy") && data.data.unchainedAction.activation.type) ||
      (!game.settings.get("pf1", "unchainedActionEconomy") && data.data.activation.type);

    // Show additional ranged properties
    data.showMaxRangeIncrements = data.data.range.units === "ft";

    // Prepare attack specific stuff
    if (data.item.type === "attack") {
      data.isWeaponAttack = data.item.data.data.attackType === "weapon";
      data.isNaturalAttack = data.item.data.data.attackType === "natural";
    }

    // Add distance units
    data.distanceUnits = duplicate(CONFIG.PF1.distanceUnits);
    if (this.item.type !== "spell") {
      for (const d of ["close", "medium", "long"]) {
        delete data.distanceUnits[d];
      }
    }

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Modify action image
    html.find(`img[data-edit="img"]`).on("click", this._onEditImage.bind(this));

    // Modify attack formula
    html.find(".attack-control").click(this._onAttackControl.bind(this));

    // Modify damage formula
    html.find(".damage-control").click(this._onDamageControl.bind(this));
  }

  /**
   * Add or remove a damage part from the damage formula
   *
   * @param {Event} event     The original click event
   * @returns {Promise}
   * @private
   */
  async _onDamageControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const list = a.closest(".damage");
    const k = list.dataset.key || "data.damage.parts";
    const k2 = k.split(".").slice(0, -1).join(".");
    const k3 = k.split(".").slice(-1).join(".");

    // Add new damage component
    if (a.classList.contains("add-damage")) {
      // Get initial data
      const initialData = ["", ""];

      // Add data
      const damage = getProperty(this.action, k2);
      const updateData = {};
      updateData[k] = getProperty(damage, k3).concat([initialData]);
      return this._onSubmit(event, { updateData });
    }

    // Remove a damage component
    if (a.classList.contains("delete-damage")) {
      const li = a.closest(".damage-part");
      const damage = duplicate(getProperty(this.action, k2));
      getProperty(damage, k3).splice(Number(li.dataset.damagePart), 1);
      const updateData = {};
      updateData[k] = getProperty(damage, k3);
      return this._onSubmit(event, { updateData });
    }
  }

  async _onAttackControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new attack component
    if (a.classList.contains("add-attack")) {
      const attackParts = this.action.data.attackParts;
      return this._onSubmit(event, { updateData: { "data.attackParts": attackParts.concat([["", ""]]) } });
    }

    // Remove an attack component
    if (a.classList.contains("delete-attack")) {
      const li = a.closest(".attack-part");
      const attackParts = duplicate(this.action.data.attackParts);
      attackParts.splice(Number(li.dataset.attackPart), 1);
      return this._onSubmit(event, { updateData: { "data.attackParts": attackParts } });
    }
  }

  async _onEditImage(event) {
    event.preventDefault();
    const filePicker = new FilePicker({
      type: "image",
      current: this.action.data.img,
      callback: async (path) => {
        await this.action.update({ img: path });
        return this.render();
      },
    });
    filePicker.render();
  }

  async _updateObject(event, formData) {
    formData = expandObject(formData);
    return this.action.update(formData.data);
  }

  async close(options) {
    delete this.item.apps[this.appId];
    delete this.action.apps[this.appId];
    return super.close(options);
  }
}
