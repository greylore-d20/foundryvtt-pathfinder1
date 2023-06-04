import { ActorPF } from "./actor-pf.mjs";

/**
 * Basic actor with no built-in functionality.
 *
 * @deprecated Obsolete with Foundry v11
 */
export class BasicActorPF extends ActorPF {
  constructor(...args) {
    foundry.utils.logCompatibilityWarning("Basic actor type will be obsolete with Foundry v11", {
      since: "PF1 0.83.0",
      until: "PF1 0.85.0",
    });
    super(...args);
  }

  _resetInherentTotals() {}

  _setSourceDetails() {}

  prepareBaseData() {}

  prepareDerivedData() {}

  applyActiveEffects() {}
}
