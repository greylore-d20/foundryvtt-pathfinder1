import { ActorNPCPF } from "./actor-npc.mjs";
import { applyChanges } from "./utils/apply-changes.mjs";

export class ActorTrapPF extends ActorNPCPF {
  prepareBaseData() {
    this.changeFlags = {};

    // Everything below this is needed for getRollData and ActorPF, but useless for the actor
    this.system.traits = { size: "med" };

    this.system.abilities = {
      str: {
        value: 10,
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

    this.system.attributes = {
      attack: { general: 0, shared: 0 },
      woundThresholds: {},
    };

    this.system.skills ??= {};
    this.sourceDetails = {};

    //  Init resources structure
    this.system.resources ??= {};
  }

  /**
   * @override
   */
  prepareDerivedData() {
    this.system.details.cr.total = this.system.details.cr.base;

    this.items.forEach((item) => {
      item._prepareDependentData(false);
      this.updateItemResources(item);
    });

    applyChanges.call(this);

    this._prepareCR();

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
  }

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  refreshDerivedData() {}

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  _resetInherentTotals() {}

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  _setSourceDetails() {}

  /** @override */
  _prepareTypeChanges(changes) {}

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

    // Spoof size as Medium instead of letting it fail to Fine
    result.size = 4;
    // Spoof range as medium tall creature
    result.range = pf1.documents.actor.ActorPF.getReach();

    // Add item dictionary flags
    result.dFlags = this.itemFlags?.dictionary ?? {};

    // Call hook
    if (Hooks.events["pf1GetRollData"]?.length > 0) Hooks.callAll("pf1GetRollData", this, result);

    this._rollData = result;
    return result;
  }
}
