const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class Troubleshooter extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pf1-troubleshooter",
    classes: ["pf1-v2", "troubleshooter"],
    window: {
      title: "PF1.Troubleshooter.Title",
      minimizable: false,
      resizable: false,
    },
    position: {
      width: 460,
    },
    actions: {
      migrate: Troubleshooter._runMigration,
      help: Troubleshooter._openHelp,
    },
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/troubleshooter.hbs",
    },
  };

  // Are packs to be unlocked?
  unlock = false;

  // Migration state
  migrating = { world: false, modules: false };

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    return {
      isGM: game.user.isGM,
      unlockPacks: this.unlock,
      migrating: this.migrating,
      links: {
        help: `<a data-action='help'>${game.i18n.localize("PF1.Troubleshooter.Steps.HelpLink")}</a>`,
        report: `<a href="https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/issues">${game.i18n.localize(
          "PF1.Troubleshooter.Steps.ReportLinkText"
        )}</a>`,
        foundry: {
          kb: `<a href="https://foundryvtt.com/kb/">${game.i18n.localize("PF1.Troubleshooter.Steps.FoundryLink")}</a>`,
          discord: `<a href="https://discord.gg/foundryvtt">Foundry VTT</a>`,
          channel: "#pf1",
        },
        faq: "https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/wikis/FAQs",
        helpmodule: `<a href="https://foundryvtt.com/packages/find-the-culprit">Find the Culprit</a>`,
      },
    };
  }

  /* -------------------------------------------- */

  /**
   * @static
   * @param {Event} event
   */
  static async _runMigration(event) {
    const unlock = this.unlock ?? false;

    /** @type {Element} */
    const el = event.target.closest("[data-action]");
    if (el.disabled) return;

    el.classList.remove("finished");
    el.disabled = true;
    el.classList.add("active");

    const target = el.dataset.target;
    const top = el.closest(".window-content").getBoundingClientRect().top + 20;

    switch (target) {
      case "world":
        this.migrating.world = true;
        await pf1.migrations.migrateWorld({ unlock, dialog: { top } });
        this.migrating.world = false;
        break;

      case "modules":
        this.migrating.modules = true;
        await pf1.migrations.migrateModules({ unlock, dialog: { top } });
        this.migrating.modules = false;
        break;

      default:
        throw new Error(`Unrecognized migration target: "${target}"`);
    }

    this.element.querySelector(".form-body").classList.remove("migrating");
    el.disabled = false;
    el.classList.remove("active");
    el.classList.add("finished");
  }

  /* -------------------------------------------- */

  /**
   * @static
   * @param {Event} event
   */
  static _openHelp(event) {
    pf1.applications.helpBrowser.openUrl("Help/Home");
  }
  /* -------------------------------------------- */

  /**
   * The event handler for changes to form input elements
   *
   * @internal
   * @param {ApplicationFormConfiguration} formConfig   The configuration of the form being changed
   * @param {Event} event                               The triggering event
   * @returns {void}
   */
  _onChangeForm(formConfig, event) {
    const target = event.target;

    if (target.matches("input[name='unlock']")) {
      this.unlock = target.checked;
    }
  }

  /* -------------------------------------------- */

  /**
   * Attach event listeners to the rendered application form.
   *
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onRender(context, options) {
    const migrationButtons = this.element.querySelectorAll("button[data-action='migrate']");

    // React to external migration to minimal degree
    if (pf1.migrations.isMigrating) {
      this.migrating.world = true;
      this.migrating.modules = true;
      for (const button of migrationButtons) {
        button.disabled = true;
        button.classList.add("active");
      }

      Hooks.once("pf1MigrationFinished", () => {
        for (const button of migrationButtons) {
          button.disabled = false;
          this.migrating.world = false;
          this.migrating.modules = false;
        }
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * @static
   */
  static open() {
    new Troubleshooter().render(true);
  }
}
