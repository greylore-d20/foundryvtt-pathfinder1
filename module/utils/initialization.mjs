/**
 * Condition/ status effects section
 */
export const getConditions = function () {
  const core = CONFIG.statusEffects.filter((c) => c.id !== "dead");
  let sys = pf1.registry.conditions.map((condition) => {
    return {
      id: condition.id,
      label: condition.name,
      icon: condition.texture,
    };
  });
  if (game.settings.get("pf1", "coreEffects")) sys.push(...core);

  sys.sort((a, b) => a.label.localeCompare(b.label));

  const deadCond = sys.findSplice((c) => c.id === "dead");
  sys = [deadCond, ...sys];

  return sys;
};
