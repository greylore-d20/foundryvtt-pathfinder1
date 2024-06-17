export class MigrationIssuesDialog extends Dialog {
  /**
   * Present simple dialog with issues within a migration category.
   *
   * @param {MigrationCategory} category
   */
  static async open(category) {
    const templateData = {
      errors: category.getErrorEntries(),
      invalid: category.getInvalidEntries(),
    };

    return this.prompt({
      title: game.i18n.localize("PF1.Migration.Dialog.Issues") + " – " + category.label,
      content: await renderTemplate("systems/pf1/templates/apps/migration-issues.hbs", templateData),
      rejectClose: false,
      options: {
        classes: [...Dialog.defaultOptions.classes, "pf1", "migration-issues"],
        jQuery: false,
        width: 620,
        height: "auto",
      },
    });
  }

  /**
   * @param {JQuery<HTMLElement>} jq
   */
  activateListeners(jq) {
    super.activateListeners(jq);

    // Copy ID/UUID to clipboard
    jq.on("click", ".issue .id a", (ev) => {
      const el = ev.target;
      const { id, uuid } = el.dataset;
      game.clipboard.copyPlainText(uuid || id);
      const type = uuid ? "UUID" : "ID";
      ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", { label: "", type, id: uuid || id }));
    });
  }
}
