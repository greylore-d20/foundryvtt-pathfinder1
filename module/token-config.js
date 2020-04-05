import { isMinimumCoreVersion } from "./lib.js";

export class TokenConfigPF extends TokenConfig {
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.template = "systems/pf1/templates/scene/token-config.html";
    options.height = 460;
    return options;
  }

  async getData(...args) {
    let result = await super.getData(...args);

    result.actor = result.actor || {};
    result.actor["vision"] = duplicate(this.token.actor.data.data.attributes.vision || {});

    result.version = result.version || {};
    result.version.v052 = isMinimumCoreVersion("0.5.2");

    return result;
  }
}
