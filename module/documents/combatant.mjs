/**
 * Combatant extension.
 */
export class CombatantPF extends Combatant {
  /**
   * Combat tracker resource update.
   * Required to deal with 0 values disappearing with core implementation
   *
   * Synchronized with Foundry 10.291
   *
   * @override
   * @returns {*} Resource value.
   */
  updateResource() {
    if (!this.actor || !this.combat) return (this.resource = null);
    return (this.resource = foundry.utils.getProperty(this.actor.system, this.parent.settings.resource) ?? null);
  }

  /**
   * Duplicate combatant with added data.
   *
   * @param {object} data - Override data
   * @param {object} context - Creation context
   * @returns {Promise<Combatant>} - Created combatant
   */
  duplicateWithData(data = {}, context = {}) {
    console.debug("Duplicating combatant:", this);
    context.parent ??= this.combat;
    return this.constructor.create(foundry.utils.mergeObject(this.toObject(), data), context);
  }

  /**
   * Get unevaluated initiative roll instance.
   *
   * @override
   * @param {string} [formula] Initiative formula override
   * @param {string} [d20=null] D20 override
   * @param {number} [bonus=null] Bonus to initiative
   * @returns {pf1.dice.D20RollPF} Initiative roll instance
   *
   * Synchronized with Foundry VTT 10.291
   */
  getInitiativeRoll(formula, d20 = null, bonus = null) {
    formula ||= this._getInitiativeFormula(d20);
    const rollData = this.actor?.getRollData() || {};
    if (bonus) {
      rollData.bonus = bonus;
      formula += " + @bonus";
    }

    return new pf1.dice.D20RollPF(formula, rollData);
  }

  /**
   * Override the default Initiative formula to customize special behaviors of the game system.
   * Apply tiebreaker if desired
   * See Combat._getInitiativeFormula for more detail.
   *
   * @override
   * @param {string} [d20=pf1.dice.D20RollPF.standardRoll] Default check roll
   * @returns {string} Initiative formula
   */
  _getInitiativeFormula(d20) {
    d20 ||= pf1.dice.D20RollPF.standardRoll;
    const defaultParts = [d20, `@attributes.init.total[${game.i18n.localize("PF1.Initiative")}]`];
    const actor = this.actor;
    if (actor && game.settings.get("pf1", "initiativeTiebreaker"))
      defaultParts.push(`(@attributes.init.total / 100)[${game.i18n.localize("PF1.Tiebreaker")}]`);
    const parts = CONFIG.Combat.initiative.formula ? CONFIG.Combat.initiative.formula.split(/\s*\+\s*/) : defaultParts;
    if (!actor) return parts[0] || "0";
    return parts.filter((p) => !!p).join(" + ");
  }
}
