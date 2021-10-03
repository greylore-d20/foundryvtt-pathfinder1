import MarkdownIt from "markdown-it";
import { SemanticVersion } from "../semver.js";

export class ChangeLogWindow extends FormApplication {
  constructor(lastVersion) {
    super({}, {});

    this.lastVersion = lastVersion;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return mergeObject(options, {
      id: "changelog",
      classes: ["pf1", "changelog"],
      template: "systems/pf1/templates/apps/changelog.hbs",
      width: 500,
      submitOnChange: true,
      closeOnSubmit: false,
    });
  }

  get title() {
    return `${game.i18n.localize("PF1.title")} ~ ${game.i18n.localize("PF1.Changelog")}`;
  }

  async getData() {
    const data = await super.getData();

    data.dontShowAgain = game.settings.get("pf1", "dontShowChangelog");

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "systems/pf1/CHANGELOG.md");

    const promise = new Promise((resolve) => {
      xhr.onload = () => {
        if (xhr.status === 200) {
          data.changelog = this._processChangelog(xhr.response);
          resolve(data);
        }
      };
    });
    xhr.send(null);

    return promise;
  }

  _processChangelog(md) {
    const MD = new MarkdownIt();

    // Cut off irrelevant changelog entries
    let lines = md.split(/[\n\r]/);
    if (this.lastVersion) {
      for (let a = 0; a < lines.length; a++) {
        const line = lines[a];
        if (line.match(/##\s+([0-9]+\.[0-9]+\.[0-9]+)/)) {
          const version = SemanticVersion.fromString(RegExp.$1);
          if (!version.isHigherThan(this.lastVersion)) {
            lines = lines.slice(0, a);
            break;
          }
        }
      }
    }

    return MD.render(lines.join("\n"));
  }

  async _updateObject(event, formData) {
    if (formData.dontShowAgain != null) {
      await game.settings.set("pf1", "dontShowChangelog", formData.dontShowAgain);
    }
  }
}
