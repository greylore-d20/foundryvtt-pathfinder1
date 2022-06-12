export class ScriptEditor extends FormApplication {
  constructor(options = {}) {
    super(options);

    this.command = options.command || "";
    this.name = options.name || null;

    this.parent = options.parent;

    this.isScriptCall = options.scriptCall === true;

    // Add editor title
    if (this.name) this.options.title = this.parent ? `${this.parent.name}: ${this.name}` : this.name;
    else this.options.title = this.parent?.name ?? game.i18n.localize("PF1.Unknown");

    this._promises = {
      submit: [],
    };
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pf1", "script-editor"],
      template: "systems/pf1/templates/apps/script-editor.hbs",
      width: 640,
      height: 560,
    });
  }

  getData() {
    const data = {};

    data.command = this.command || "";
    data.name = this.name;

    data.isScriptCall = this.isScriptCall;

    data.canEdit = {
      name: data.name != null,
    };

    return data;
  }

  awaitResult() {
    let callback;
    const promise = new Promise((resolve) => {
      callback = resolve;
    });
    this._promises.submit.push({ callback, promise, resolved: false });
    return promise;
  }

  activateListeners(html) {
    html.find('button[type="submit"]').click(this._onSubmit.bind(this));

    // Open help browser
    html.find("a.help-browser[data-url]").click(this._openHelpBrowser.bind(this));
  }

  _openHelpBrowser(event) {
    event.preventDefault();
    const a = event.currentTarget;
    game.pf1.helpBrowser.openUrl(a.dataset.url);
  }

  _updateObject(event, formData) {
    this.command = formData["command"];
    this.name = formData["name"] || null;

    const result = {
      command: this.command,
      name: this.name,
    };

    this.resolvePromises("submit", result);
  }

  resolvePromises(type, result) {
    for (const p of this._promises[type]) {
      if (!p.resolved) {
        p.callback(result);
        p.resolved = true;
      }
    }
  }

  async close(...args) {
    super.close(...args);

    this.resolvePromises("submit", null);
  }
}
