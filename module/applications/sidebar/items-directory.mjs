export class ItemDirectoryPF extends ItemDirectory {
  /**
   * Enrich default options for detecting identified/unidentified name changes
   *
   * @override
   */
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.renderUpdateKeys.push("system.unidentified.name", "system.identified");
    return options;
  }
}
