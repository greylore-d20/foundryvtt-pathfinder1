/**
 * Condition/ status effects section
 */
export const getConditions = function () {
  const core = CONFIG.statusEffects;
  let sys = pf1.registry.conditions.map((condition) => {
    return {
      id: condition.id,
      label: condition.name,
      icon: condition.texture,
    };
  });
  if (game.settings.get("pf1", "coreEffects")) sys.push(...core);
  else {
    const deadCond = core.find((e) => e.id === "dead");
    sys = [deadCond, ...sys];
  }
  return sys.sort((a, b) => a.label.localeCompare(b.label));
};
