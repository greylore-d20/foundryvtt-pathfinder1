/**
 * Condition/ status effects section
 */
export const getConditions = function () {
  const core = CONFIG.statusEffects.filter((c) => c.id !== "dead");
  let sys = pf1.registry.conditions.map((condition) => {
    const status = condition.toStatusEffect();

    // Copy of Foundry's deprecation code
    for (const [oldKey, newKey] of Object.entries({ label: "name", icon: "img" })) {
      const msg = `StatusEffectConfig#${oldKey} has been deprecated in favor of StatusEffectConfig#${newKey}`;
      Object.defineProperty(status, oldKey, {
        get() {
          foundry.utils.logCompatibilityWarning(msg, { since: 12, until: 14, once: true });
          return this[newKey];
        },
        set(value) {
          foundry.utils.logCompatibilityWarning(msg, { since: 12, until: 14, once: true });
          this[newKey] = value;
        },
        enumerable: false,
        configurable: true,
      });
    }

    return status;
  });

  if (game.settings.get("pf1", "coreEffects")) sys.push(...core);

  sys.sort((a, b) => a.name.localeCompare(b.name));

  const deadCond = sys.findSplice((c) => c.id === "dead");
  sys = [deadCond, ...sys];

  return sys;
};
