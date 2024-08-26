/**
 * Condition/ status effects section
 */
export const getConditions = function () {
  const core = CONFIG.statusEffects.filter((c) => c.id !== "dead");
  let sys = pf1.registry.conditions.map((condition) => ({
    id: condition.id,
    name: condition.name,
    icon: condition.texture,
    // Compatibiliy shims with Foundry
    get label() {
      return this.name;
    },
    set label(name) {
      this.name = name;
    },
  }));
  if (game.settings.get("pf1", "coreEffects")) sys.push(...core);

  sys.sort((a, b) => a.label.localeCompare(b.label));

  const deadCond = sys.findSplice((c) => c.id === "dead");
  sys = [deadCond, ...sys];

  return sys;
};
