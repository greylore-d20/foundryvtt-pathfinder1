export class MigrationIssuesDialog extends Dialog {
  /**
   * Present simple dialog with issues within a migration category.
   *
   * @param {MigrationCateory} category
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
}
