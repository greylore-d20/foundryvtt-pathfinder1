/**
 * Base actor class with minimal functionality.
 *
 * Provides only caching of .itemTypes and nothing else.
 */
export class ActorBasePF extends Actor {
  constructor(...args) {
    super(...args);

    this._itemTypes ??= null;
  }

  /**
   * Resets internal itemTypes cache.
   *
   * @override
   */
  prepareBaseData() {
    super.prepareBaseData();

    // Reset item types cache
    this._itemTypes = null;
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
    this._itemTypes ??= super.itemTypes;
    return this._itemTypes;
  }

  /**
   * Returns first active owner, favoring players and GM as fallback.
   *
   * @type {User|null}
   */
  get activeOwner() {
    const firstOwner =
      Object.keys(this.ownership)
        .map((userId) => game.users.get(userId))
        .filter((u) => u?.active && !u.isGM)
        .filter((user) => this.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER))
        .sort((a, b) => (a.id > b.id ? 1 : -1))[0] ?? null;

    return firstOwner ?? game.users.activeGM;
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
