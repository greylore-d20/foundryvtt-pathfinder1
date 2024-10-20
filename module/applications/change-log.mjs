import { SemanticVersion } from "@utils/semver.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Changelog Dialog
 */
export class ChangeLogWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "changelog",
    tag: "form",
    form: {
      handler: ChangeLogWindow._updateObject,
      submitOnChange: true,
      closeOnSubmit: false,
    },
    classes: ["pf1-v2", "changelog"],
    window: {
      minimizable: true,
      resizable: true,
    },
    position: {
      width: 500,
      height: 680,
    },
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/changelog.hbs",
    },
  };

  _cache;

  /**
   * @param {boolean} lastVersion - Display only latest version, legacy versions are to be omitted.
   * @param {boolean} autoDisplay - Is the dialog being shown without prompting?
   */
  constructor(lastVersion = false, autoDisplay = false) {
    super({}, {});

    this.lastVersion = lastVersion;
    this.autoDisplay = autoDisplay;
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @override
   * @returns {string}
   */
  get title() {
    return `${game.i18n.localize("PF1.Title")} ~ ${game.i18n.localize("PF1.Application.Changelog.Title")}`;
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const context = {};

    context.dontShowAgain = game.settings.get("pf1", "dontShowChangelog");
    context.autoDisplay = this.autoDisplay;
    context.lastVersion = this.lastVersion;

    if (!this._cache) {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", "systems/pf1/CHANGELOG.md");

      const promise = new Promise((resolve) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            this._cache = this._processChangelog(xhr.response);
          } else {
            context.error = {
              number: xhr.status,
              message: xhr.statusText,
              url: xhr.responseURL,
            };
          }
          resolve();
        };
      });
      xhr.send(null);

      await promise;
    }

    context.changelog = this._cache;
    context.link = game.system.changelog;

    return context;
  }

  /* -------------------------------------------- */

  /**
   * @internal
   * @param {string} md
   * @returns {string}
   */
  _processChangelog(md) {
    const converter = new showdown.Converter();

    const latestVersion = SemanticVersion.fromString(game.system.version);
    const latestMajor = latestVersion.major;
    const latest = [];
    const major = [];
    const majorPatches = [];
    const legacy = [];

    let currentVersion = null;

    const lines = md.split(/[\n\r]+/);

    for (const line of lines) {
      if (/^#\s/.test(line)) continue; // Ignore H1

      if (line.match(/##\s+([0-9]+\.[0-9]+(\.[0-9]+)?)/)) {
        currentVersion = SemanticVersion.fromString(RegExp.$1);
        if (currentVersion.major === latestMajor) {
          majorPatches.push(currentVersion);
        }
      }

      // Skip lines not assoociated with any version
      if (!currentVersion) continue;
      // Split other lines to appropriate pools
      if (currentVersion.isSame(latestVersion)) latest.push(line);
      else if (currentVersion.major === latestMajor) major.push(line);
      else if (!this.lastVersion) legacy.push(line);
    }

    return {
      version: latestVersion,
      latest: {
        content: converter.makeHtml(latest.join("\n")),
      },
      major: {
        patches: majorPatches,
        content: major.length ? converter.makeHtml(major.join("\n")) : null,
      },
      legacy: {
        content: legacy.length ? converter.makeHtml(legacy.join("\n")) : null,
      },
    };
  }

  /* -------------------------------------------- */

  /**
   * Cancel distribution and close dialog
   *
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @static
   * @internal
   * @this {ApplicationV2&ChangeLogWindow}
   * @returns {Promise<void>}
   */
  static async _updateObject(event, form, formData) {
    formData = formData.object;
    if (formData.dontShowAgain != null) {
      await game.settings.set("pf1", "dontShowChangelog", formData.dontShowAgain);
    }
  }
}
