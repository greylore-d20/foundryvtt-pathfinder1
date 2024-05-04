import { TooltipWorldConfig } from "./tooltip_world.mjs";

export class TokenTooltipConfigModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      disable: new fields.BooleanField({ initial: false }),
      hideWithoutKey: new fields.BooleanField({ initial: false }),
      anchor: new fields.SchemaField({
        x: new fields.NumberField({ initial: 1 }),
        y: new fields.NumberField({ initial: 1 }),
      }),
      offset: new fields.SchemaField({
        x: new fields.NumberField({ initial: 0 }),
        y: new fields.NumberField({ initial: 0 }),
      }),
      onMouse: new fields.BooleanField({ initial: false }),
      portrait: new fields.SchemaField({
        hide: new fields.BooleanField({ initial: false }),
        maxSize: new fields.SchemaField({
          width: new fields.NumberField({ initial: 280 }),
          height: new fields.NumberField({ initial: 280 }),
        }),
      }),
    };
  }
}

export class TooltipConfig extends FormApplication {
  constructor(object, options) {
    super(object, options);

    this._cachedData = null;
  }

  getData() {
    if (this._cachedData) return this._cachedData;

    const canvasRect = canvas.app.view.getBoundingClientRect();
    const result = {
      screen: {
        width: canvasRect.width,
        height: canvasRect.height,
        halfWidth: Math.floor(canvasRect.width / 2),
        halfHeight: Math.floor(canvasRect.height / 2),
      },
      isGM: game.user.isGM,
    };

    // Prepare preview data
    {
      const p = {
        width: 320,
        height: 320,
        tooltip: {
          width: 80,
          height: 48,
        },
      };

      const r1 = result.screen.width / result.screen.height;
      const r2 = result.screen.height / result.screen.width;

      if (r1 > r2) {
        p.height = Math.ceil(p.height * r2);
      } else if (r2 > r1) {
        p.width = Math.ceil(p.width * r1);
      }

      result.preview = p;
    }

    // Get settings
    result.data = game.settings.get("pf1", "tooltipConfig");

    // Get hide key
    result.hideKey = game.i18n.localize("PF1.Key_Control");

    this._cachedData = result;
    return result;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("PF1.SETTINGS.TokenTooltip.Name"),
      id: "tooltip-config",
      template: "systems/pf1/templates/settings/tooltip.hbs",
      width: 640,
      height: "auto",
    });
  }

  activateListeners(html) {
    html.find(".immediate-change").change(this._handleImmediateChange.bind(this));

    html.find("button.world-settings").click(this._openWorldSettings.bind(this));

    html.find('button[name="submit"]').click(this._onSubmit.bind(this));
    html.find('button[name="reset"]').click(this._onReset.bind(this));
  }

  _handleImmediateChange(event) {
    const el = event.currentTarget;
    const key = el.name;
    if (!key) return;

    let value;
    if (el.tagName === "INPUT") {
      value = el.value;
      if (el.type === "checkbox") value = el.checked === true ? true : false;
    } else {
      value = el.innerHTML;
    }
    if (el.dataset?.dtype === "Boolean") value = Boolean(value);
    else if (el.dataset?.dtype === "Number") value = parseFloat(value);

    foundry.utils.setProperty(this._cachedData, `data.${key}`, value);
    this.render();
  }

  _openWorldSettings(event) {
    if (!game.user.can("SETTINGS_MODIFY"))
      return void ui.notifications.error("PF1.Error.GenericPermission", { localize: true });

    new TooltipWorldConfig().render(true, { focus: true });
  }

  async _onReset(event) {
    event.preventDefault();
    await game.settings.set("pf1", "tooltipConfig", this.constructor.defaultSettings);
    this._cachedData = null;
    ui.notifications.info(game.i18n.localize("PF1.SETTINGS.TokenTooltip.ResetInfo"));
    return this.render();
  }

  async _updateObject(event, formData) {
    const settings = foundry.utils.expandObject(formData);

    await game.settings.set("pf1", "tooltipConfig", settings);
    ui.notifications.info(game.i18n.localize("PF1.SETTINGS.TokenTooltip.UpdateInfo"));
  }
}
