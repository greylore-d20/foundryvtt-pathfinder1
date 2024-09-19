import { SemanticVersion } from "../utils/semver.mjs";

/**
 * Changelog Dialog
 */
export class ChangeLogWindow extends FormApplication {
  /**
   * @param {boolean} lastVersion - Display only latest version, legacy versions are to be omitted.
   * @param {boolean} autoDisplay - Is the dialog being shown without prompting?
   */
  constructor(lastVersion = false, autoDisplay = false) {
    super({}, {});

    this.lastVersion = lastVersion;
    this.autoDisplay = autoDisplay;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      id: "changelog",
      classes: [...options.classes, "pf1", "changelog"],
      template: "systems/pf1/templates/apps/changelog.hbs",
      tabs: [
        {
          initial: "latest",
          navSelector: "nav.tabs[data-group='primary']",
          contentSelector: "section.content",
          group: "primary",
        },
      ],
      width: 500,
      height: 680,
      submitOnChange: true,
      closeOnSubmit: false,
    };
  }

  get title() {
    return `${game.i18n.localize("PF1.Title")} ~ ${game.i18n.localize("PF1.Application.Changelog.Title")}`;
  }

  _cache;

  async getData() {
    const context = await super.getData();

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

  async _updateObject(event, formData) {
    if (formData.dontShowAgain != null) {
      await game.settings.set("pf1", "dontShowChangelog", formData.dontShowAgain);
    }
  }
}
