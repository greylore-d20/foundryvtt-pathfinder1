/**
 * Condition/ status effects section
 */
export const getConditions = function () {
  const core = CONFIG.statusEffects.filter((c) => c.id !== "dead");
  let sys = pf1.registry.conditions.map((condition) => {
    return {
      id: condition.id,
      name: condition.name,
      img: condition.texture,
      // Cheap compatibility shim alike to what Foundry has (until Foundry v14)
      get label() {
        return this.name;
      },
      set label(v) {
        this.name = v;
      },
      get icon() {
        return this.img;
      },
      set icon(v) {
        this.img = v;
      },
    };
  });

  if (game.settings.get("pf1", "coreEffects")) sys.push(...core);

  sys.sort((a, b) => a.name.localeCompare(b.name));

  const deadCond = sys.findSplice((c) => c.id === "dead");
  sys = [deadCond, ...sys];

  return sys;
};
