/**
 * Determines what ability modifier is appropriate for a given score.
 *
 * @param {number} [score] - The score to find the modifier for.
 * @param {object} [options={}] - Options for this function.
 * @param {number} [options.penalty=0] - A penalty value to take into account.
 * @param {number} [options.damage=0] - Ability score damage to take into account.
 * @returns {number} The modifier for the given score.
 */
export function getAbilityModifier(score = null, options = {}) {
  if (score != null) {
    const penalty = Math.abs(options.penalty ?? 0);
    const damage = Math.abs(options.damage ?? 0);
    return Math.max(-5, Math.floor((score - 10) / 2) - Math.floor(penalty / 2) - Math.floor(damage / 2));
  }
  return 0;
}
