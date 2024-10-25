import { ActorPF } from "./actor-pf.mjs";
import { applyChanges } from "./utils/apply-changes.mjs";

export class ActorVehiclePF extends ActorPF {
  prepareBaseData() {
    this._resetInherentTotals();

    this.sourceInfo = {};
    this.changeFlags = {};
    this.system.resources ??= {};

    // Add base initiative
    this.system.attributes.init.total = this.system.attributes.init.value;
    this.system.attributes.cmd.total = 10;
    this.system.attributes.ac.normal.total = this.system.attributes.ac.normal.base;
    this.system.attributes.savingThrows.save.total = this.system.attributes.savingThrows.save.base;

    // Everything below this is needed for getRollData and ActorPF, but useless for the actor
    this.system.attributes.attack ??= { general: 0, shared: 0 };
    this.system.attributes.woundThresholds ??= {};
    this.system.skills ??= {};
    this.system.attributes.speed ??= {};
    this.system.attributes.cmb ??= {};

    const strValue = this.system.abilities.str.value;
    this.system.abilities = {
      str: {
        value: strValue,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
      dex: {
        value: 10,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
      con: {
        value: 10,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
      int: {
        value: 10,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
      wis: {
        value: 10,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
      cha: {
        value: 10,
        damage: 0,
        drain: 0,
        userPenalty: 0,
        mod: 0,
        total: 10,
      },
    };

    this.system.attributes.cmbAbility = "str";

    this.sourceDetails = {};

    //  Init resources structure
    this.system.resources ??= {};
  }

  _getInherentTotalsKeys() {
    return {
      "attributes.hp.max": this.system.attributes?.hp?.base ?? 0,
      "details.carryCapacity.bonus.total": 0,
      "details.carryCapacity.multiplier.total": 0,
    };
  }

  /**
   * @override
   * @inheritDoc
   */
  _getBaseValueFillKeys() {
    return [{ parent: "abilities.str", key: "base", value: 0 }];
  }

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  prepareDerivedData() {
    this.items.forEach((item) => {
      item._prepareDependentData(false);
      this.updateItemResources(item);
    });

    applyChanges.call(this);

    this.prepareHealth();
    this._computeEncumbrance();

    this.prepareCMB();

    // Setup links
    this.prepareItemLinks();

    // Reset roll data cache again to include processed info
    this._rollData = null;

    // Update item resources
    this.items.forEach((item) => {
      item._prepareDependentData(true);
      // because the resources were already set up above, this is just updating from current roll data - so do not warn on duplicates
      this.updateItemResources(item, { warnOnDuplicate: false });
    });

    this._setSourceDetails();
  }

  /**
   * @override
   */
  prepareCMB() {
    const base = this.system.abilities.str.value || 0,
      size = this.system.traits.size.value,
      szCMBMod = Object.values(pf1.config.sizeSpecialMods)[size] ?? 0;

    this.system.attributes.cmb.total = base + szCMBMod;
  }

  prepareHealth() {
    // Offset relative health
    const hp = this.system.attributes.hp;
    if (!Number.isFinite(hp?.offset)) hp.offset = 0;
    hp.value = hp.max + hp.offset;
  }

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  refreshDerivedData() {}

  _prepareTypeChanges(changes) {
    changes.push(
      // CMB
      new pf1.components.ItemChange({
        formula: "@abilities.str.value",
        operator: "add",
        target: "cmb",
        type: "base",
        flavor: game.i18n.localize("PF1.Base"),
      }),
      // CMD
      new pf1.components.ItemChange({
        formula: "@attributes.cmd.value",
        operator: "add",
        target: "cmd",
        type: "base",
        flavor: game.i18n.localize("PF1.Base"),
      })
    );
  }

  getRollData(options = { refresh: false }) {
    // Return cached data, if applicable
    const skipRefresh = !options.refresh && this._rollData;

    const result = { ...(skipRefresh ? this._rollData : foundry.utils.deepClone(this.system)) };

    // Clear certain fields if not refreshing
    if (skipRefresh) {
      for (const path of pf1.config.temporaryRollDataFields.actor) {
        foundry.utils.setProperty(result, path, undefined);
      }
    }

    /* ----------------------------- */
    /* Always add the following data
    /* ----------------------------- */

    // Add combat round, if in combat
    if (game.combats?.viewed) {
      result.combat = {
        round: game.combat.round || 0,
      };
    }

    // Return cached data, if applicable
    if (skipRefresh) return result;

    /* ----------------------------- */
    /* Set the following data on a refresh
      /* ----------------------------- */

    // Set size index
    const sizes = Object.values(pf1.config.sizeChart);
    result.size = Math.clamped(result.traits.size.value, 0, sizes.length - 1);
    result.tokenSize = Math.clamped(result.traits.size.token, 0, sizes.length - 1);

    // Add item dictionary flags
    result.dFlags = this.itemFlags?.dictionary ?? {};

    // Add range info
    result.range = pf1.documents.actor.ActorPF.getReach(this.system.traits.size, this.system.traits.stature);

    // Wound Threshold isn't applicable
    result.attributes.woundThresholds = { level: 0 };

    // Traps don't have ACP
    result.attributes.acp = { attackPenalty: 0 };

    // Call hook
    if (Hooks.events["pf1GetRollData"]?.length > 0) Hooks.callAll("pf1GetRollData", this, result);

    this._rollData = result;
    return result;
  }

  /**
   * @remarks - Vehicles don't have weightless currency
   * @override
   * @inheritDoc
   */
  getTotalCurrency({ inLowestDenomination = true } = {}) {
    const total = this.getCurrency("currency", { inLowestDenomination: true });
    return inLowestDenomination ? total : total / 100;
  }
}
