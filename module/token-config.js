export class TokenConfigPF extends TokenConfig {
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.template = "systems/pf1/templates/scene/token-config.html";
    options.height = 420;
    return options;
  }
}
