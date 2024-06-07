import { ActorPF } from "./actor-pf.mjs";
import { applyChanges } from "./utils/apply-changes.mjs";

export class ActorVehiclePF extends ActorPF {
  prepareBaseData() {
    // Forced deletion to ensure rolldata gets refreshed.
    delete this._rollData;

    // Add base initiative
    this.system.attributes.init.total = this.system.attributes.init.value;
    this.system.attributes.cmd.total = this.system.attributes.cmd.value;
    this.system.attributes.ac.normal.total = this.system.attributes.ac.normal.base;
    this.system.attributes.savingThrows.save.total = this.system.attributes.savingThrows.save.base;

    // Everything below this is needed for getRollData and ActorPF, but useless for the actor
    this.system.attributes.attack ??= { general: 0, shared: 0 };
    this.system.attributes.woundThresholds ??= {};
    this.system.skills ??= {};
    this.system.attributes.speed ??= {};

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

    this.sourceDetails = {};

    //  Init resources structure
    this.system.resources ??= {};
  }

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
  prepareDerivedData() {
    this.items.forEach((item) => {
      item._prepareDependentData(false);
      this.updateItemResources(item);
    });

    applyChanges.call(this);

    this.prepareHealth();

    // Setup links
    this.prepareItemLinks();

    // Reset roll data cache again to include processed info
    delete this._rollData;

    // Update item resources
    this.items.forEach((item) => {
      item._prepareDependentData(true);
      // because the resources were already set up above, this is just updating from current roll data - so do not warn on duplicates
      this.updateItemResources(item, { warnOnDuplicate: false });
    });

    this._initialized = true;
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

  /**
   * Needed to prevent unnecessary behavior in ActorPF
   *
   * @override
   */
  _prepareChanges() {
    this.changeItems = this.items.filter(
      (item) =>
        item.isActive &&
        (item.system.changes?.length > 0 || Object.values(item.system.changeFlags ?? {}).some((v) => !!v))
    );

    const changes = [];
    for (const i of this.changeItems) {
      changes.push(...i.changes);
    }

    const c = new Collection();
    for (const change of changes) {
      // Avoid ID conflicts
      const parentId = change.parent?.id ?? "Actor";
      const uniqueId = `${parentId}-${change._id}`;
      c.set(uniqueId, change);
    }
    this.changes = c;
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
    const sizeChart = Object.keys(pf1.config.sizeChart);
    result.size = sizeChart.indexOf(result.traits.size);

    // Add item dictionary flags
    result.dFlags = this.itemFlags?.dictionary ?? {};

    // Add range info
    result.range = pf1.documents.actor.ActorPF.getReach(this.system.traits.size, this.system.traits.stature);

    // Wound Threshold isn't applicable
    result.attributes.woundThresholds = { level: 0 };

    // Traps don't have ACP
    result.attributes.acp = { attackPenalty: 0 };

    this._rollData = result;
    return result;
  }
}
