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

  /**
   * Override Foundry's render to catch unidentified name changes (Foundry's "k in d" doesn't work).
   *
   * @override
   */
  async _render(force = false, context = {}) {
    // Only re-render the sidebar directory for certain types of updates
    const { action, data, documentType } = context;
    if (action && !["create", "update", "delete"].includes(action)) return this;
    if (
      documentType !== "Folder" &&
      action === "update" &&
      !data.some((d) => this.options.renderUpdateKeys.some((k) => foundry.utils.getProperty(d, k) !== undefined))
    )
      return;

    // Re-build the tree and render
    this.initialize();
    // Skip ItemDirectory & SidebarDirectory _render, both of which use k in d culling
    return SidebarTab.prototype._render.call(this, force, context);
  }
}
