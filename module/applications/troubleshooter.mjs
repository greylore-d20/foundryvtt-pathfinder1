export class Troubleshooter extends Application {
  get title() {
    return game.i18n.localize("PF1.Troubleshooter.Title");
  }

  get template() {
    return "systems/pf1/templates/apps/troubleshooter.hbs";
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "pf1", "troubleshooter"],
      id: "pf1-troubleshooter",
      width: 460,
    };
  }

  getData() {
    return {
      isGM: game.user.isGM,
      links: {
        help: `<a data-action='help'>${game.i18n.localize("PF1.Troubleshooter.Steps.HelpLink")}</a>`,
        report: `<a href="https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/issues">${game.i18n.localize(
          "PF1.Troubleshooter.Steps.ReportLinkText"
        )}</a>`,
        foundry: {
          discord: `<a href="https://discord.gg/foundryvtt">Foundry VTT</a>`,
          channel: "#pf1",
        },
        faq: "https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/wikis/FAQs",
        helpmodule: `<a href="https://foundryvtt.com/packages/find-the-culprit">Find the Culprit</a>`,
      },
    };
  }

  /**
   * @param {Event} event
   */
  async _runMigration(event) {
    if (!game.user.isGM) return;

    /** @type {Element} */
    const el = event.target;
    el.classList.remove("finished");
    el.disabled = true;

    const target = el.dataset.target;
    switch (target) {
      case "world":
        await pf1.migrations.migrateWorld();
        break;
      case "modules":
        await pf1.migrations.migrateModules({ unlock: false });
        break;
      default:
        throw new Error(`Unrecognized migration target: "${target}"`);
    }

    el.disabled = false;
    el.classList.add("finished");
  }

  _openHelp(event) {
    pf1.applications.helpBrowser.openUrl("Help/Home");
  }

  /**
   * @param {JQuery} jq
   * @override
   */
  activateListeners(jq) {
    super.activateListeners(jq);

    const [html] = jq;

    const migrationButtons = html.querySelectorAll("button[data-action='migrate']");

    for (const button of migrationButtons) {
      button.addEventListener("click", this._runMigration.bind(this));
    }

    // React to external migration to minimal degree
    if (pf1.migrations.isMigrating) {
      for (const button of migrationButtons) {
        button.disabled = true;
      }

      Hooks.once("pf1MigrationFinished", () => {
        for (const button of migrationButtons) {
          button.disabled = false;
        }
      });
    }

    html.querySelector("a[data-action='help']").addEventListener("click", this._openHelp.bind(this));
  }

  static open() {
    new Troubleshooter().render(true, { focus: true });
  }
}
