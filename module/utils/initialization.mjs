/**
 * Condition/ status effects section
 */
export const getConditions = function () {
  const core = CONFIG.statusEffects;
  let sys = pf1.registry.conditions.map((condition) => {
    return {
      id: condition.id,
      name: condition.name,
      img: condition.texture,
      // Cheap compatibility shim alike to what Foundry has (until Foundry v14)
      get label() {
        return this.name;
      },
      get icon() {
        return this.img;
      },
    };
  });

  if (game.settings.get("pf1", "coreEffects")) sys.push(...core);
  else {
    const deadCond = core.find((e) => e.id === "dead");
    sys = [deadCond, ...sys];
  }

  // BUG: This sorting ignores configured language
  return sys.sort((a, b) => a.name.localeCompare(b.name));
};
