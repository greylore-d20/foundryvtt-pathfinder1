/**
 * Base actor class with minimal functionality.
 *
 * Provides only caching of .itemTypes and nothing else.
 */
export class ActorBasePF extends Actor {
  constructor(...args) {
    super(...args);

    // Init .itemTypes cache
    this._itemTypes ??= null;
  }

  /**
   * Resets internal itemTypes cache.
   *
   * @protected
   * @override
   */
  prepareBaseData() {
    // Reset item types cache
    this._itemTypes = null;
    // Reset roll data cache if it exists.
    delete this._rollData;

    super.prepareBaseData();
  }

  /**
   * Get item by its identifier tag.
   *
   * @param {string} tag - Desired tag.
   * @returns {Item|undefined} - Matching item or undefined if no item is found.
   */
  getItemByTag(tag) {
    return this.items.find((o) => o.system.tag === tag);
  }

  /**
   * @protected
   * @override
   */
  prepareData() {
    this._initializing = true; // For initialization detection to deal with Foundry's out-of-order preparation bug
    super.prepareData();
    delete this._initializing;
  }

  /**
   * Cached result of .itemTypes
   *
   * @internal
   * @type {ItemTypesMap}
   */
  _itemTypes;

  /**
   * Cached override
   *
   * @override
   * @type {ItemTypesMap}
   */
  get itemTypes() {
    if (!this._itemTypes) {
      this._itemTypes = super.itemTypes;

      // Enrich the arrays with getName() and getId()
      for (const items of Object.values(this._itemTypes)) {
        Object.defineProperties(items, {
          getName: {
            value: function (name) {
              return this.find((i) => i.name === name);
            },
          },
          getId: {
            value: function (identifier) {
              return this.find((i) => i.system.tag === identifier);
            },
          },
        });
      }
    }
    return this._itemTypes;
  }

  /**
   * Returns first active owner, favoring players and GM as fallback.
   *
   * @type {User|null}
   */
  get activeOwner() {
    const firstOwner =
      game.users
        .filter((u) => u.active && !u.isGM)
        .filter((u) => this.testUserPermission(u, "OWNER"))
        .sort((a, b) => (a.id > b.id ? 1 : -1))[0] ?? null;

    return firstOwner ?? game.users.activeGM;
  }

  /**
   * Get related combatants.
   *
   * @param {Combat} [combat=game.combat] Combat instance
   * @returns {Combatant[]} Related combatants.
   */
  getCombatants(combat = game.combat) {
    return combat?.combatants.filter((c) => c.actor === this) ?? [];
  }

  /**
   * @type {boolean} - Whether current user can see through this actor.
   */
  get sharesVision() {
    const visionFlag = this.getFlag("pf1", "visionSharing");
    if (!visionFlag) return false;

    const shared = visionFlag.users[game.user.id] ?? null;
    if (shared === true) return true;
    else if (shared === false) return false;
    // Else handle by default rule
    return visionFlag.default ?? false;
  }
}

/**
 * All items sorted by type.
 *
 * @typedef ItemTypesMap
 * @property {ItemAttackPF[]} attack
 * @property {ItemBuffPF[]} buff
 * @property {ItemClassPF[]} class
 * @property {ItemConsumablePF[]} consumable
 * @property {ItemContainerPF[]} container
 * @property {ItemEquipmentPF[]} equipment
 * @property {ItemFeatPF[]} feat
 * @property {ItemLootPF[]} loot
 * @property {ItemRacePF[]} race
 * @property {ItemSpellPF[]} spell
 * @property {ItemWeaponPF[]} weapon
 */
