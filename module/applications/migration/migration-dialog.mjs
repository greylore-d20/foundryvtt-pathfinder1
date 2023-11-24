import { MigrationState } from "../../migration/migration-state.mjs";
import { MigrationIssuesDialog as MigrationIssuesDialog } from "./migration-issues-dialog.mjs";

export class MigrationDialog extends Application {
  /**
   * Migration state object.
   *
   * @type {MigrationState}
   */
  state;

  constructor(state, options) {
    super(options);

    this.state = state;

    this.autoClose = options.autoClose ?? false;

    state.callbacks[this.appId] = this._onMigration.bind(this);
  }

  get title() {
    const label = game.i18n.localize("PF1.Migration.Dialog.Title");
    if (this.state.label) return `${label}: ${this.state.label}`;
    return label;
  }

  get template() {
    return "systems/pf1/templates/apps/migration.hbs";
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "pf1", "migration"],
      width: "auto",
      height: "auto",
      top: 200,
      resizable: true,
    };
  }

  getData() {
    return {
      state: this.state,
    };
  }

  /**
   * @override
   * @param {JQuery<HTMLElement>} jq
   */
  activateListeners(jq) {
    super.activateListeners(jq);

    if (this.state.completed && this.autoClose) {
      setTimeout(() => this.close(), 2_000);
    }

    const html = jq[0];

    html.querySelectorAll(".value.has-details").forEach((el) => {
      el.addEventListener("click", this._onClickForDetails.bind(this));
    });
  }

  _onClickForDetails(event) {
    event.preventDefault();

    const el = event.target.closest(".category");
    const categoryId = el.dataset.category;
    const category = this.state.categories[categoryId];

    MigrationIssuesDialog.open(category);
  }

  /**
   * @param {MigrationCategory|MigrationState} state
   * @param {object} info
   */
  _onMigration(state, info) {
    // Queue render if already rendering
    if (this._state === Application.RENDER_STATES.RENDERING) this._queueRender = true;
    else this.render();
  }

  /**
   * @override
   */
  async _render(...args) {
    const rv = await super._render(...args);

    // Handle queued render
    if (this._queueRender) {
      this._queueRender = false;
      this.render();
    }

    return rv;
  }

  /**
   * @override
   * @param  {...any} args
   * @returns
   */
  async close(...args) {
    delete this.state.callbacks[this.appId];
    return super.close(...args);
  }

  /**
   * Initialize migration dialog and migration state tracker if necessary.
   *
   * @param {MigrationState} [state] - Existing state tracker if any
   * @param {string} [label] - Label associated with the tracker
   * @param {object} [dialogOptions={}] - Dialog options
   * @returns {MigrationDialog} - Active state tracker
   */
  static initialize(state, label, dialogOptions = {}) {
    state ??= new MigrationState(label);
    state.label ||= label;

    const app = new this(state, { autoClose: dialogOptions.autoClose ?? false });
    app.render(true, dialogOptions);
    return app;
  }
}
