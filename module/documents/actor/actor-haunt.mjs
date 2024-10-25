import { ActorNPCPF } from "./actor-npc.mjs";
import { applyChanges } from "./utils/apply-changes.mjs";

export class ActorHauntPF extends ActorNPCPF {
  prepareBaseData() {
    this.changeFlags = {};

    // Needed for getRollData and ActorPF, but useless for the actor
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

    this.system.attributes.attack ??= { general: 0, shared: 0 };

    this.system.skills ??= {};
    this.sourceDetails = {};

    //  Init resources structure
    this.system.resources ??= {};
  }

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  prepareDerivedData() {
    this.system.details.cr.total = this.system.details.cr.base;
    this.system.attributes.init.total = this.system.attributes.init.value;

    this.items.forEach((item) => {
      item._prepareDependentData(false);
      this.updateItemResources(item);
    });

    applyChanges.call(this);

    this._prepareCR();

    this.prepareHealth();

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

    // Caster Level
    result.cl = result.details.cl;

    // Return cached data, if applicable
    if (skipRefresh) return result;

    /* ----------------------------- */
    /* Set the following data on a refresh
    /* ----------------------------- */

    // Spoof size as Medium instead of letting it fail to Fine
    result.size = 4;

    // Add item dictionary flags
    result.dFlags = this.itemFlags?.dictionary ?? {};

    // Add range info
    result.range = pf1.documents.actor.ActorPF.getReach(this.system.traits.size, this.system.traits.stature);

    // Wound Threshold isn't applicable
    result.attributes.woundThresholds = { level: 0 };

    // Haunts don't have ACP
    result.attributes.acp = { attackPenalty: 0 };

    // Call hook
    if (Hooks.events["pf1GetRollData"]?.length > 0) Hooks.callAll("pf1GetRollData", this, result);

    this._rollData = result;
    return result;
  }
}
