import { TooltipWorldConfig } from "./tooltip_world.js";

export class TooltipConfig extends FormApplication {
  constructor(object, options) {
    super(object || TooltipConfig.defaultSettings, options);

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
    let settings = game.settings.get("pf1", "tooltipConfig");
    settings = mergeObject(this.constructor.defaultSettings, settings);
    result.data = settings;

    this._cachedData = result;
    return result;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("PF1.TooltipConfigName"),
      id: "tooltip-config",
      template: "systems/pf1/templates/settings/tooltip.hbs",
      width: 720,
      height: "auto",
    });
  }

  static get defaultSettings() {
    return {
      disable: false,
      anchor: {
        x: 1,
        y: 1,
      },
      offset: {
        x: 0,
        y: 0,
      },
      onMouse: false,
      portrait: {
        hide: false,
        maxSize: {
          width: 280,
          height: 280,
        },
      },
    };
  }

  activateListeners(html) {
    html.find(".immediate-change").change(this._handleImmediateChange.bind(this));

    html.find("button.world-settings").click(this._openWorldSettings.bind(this));

    html.find('button[name="submit"]').click(this._onSubmit.bind(this));
    html.find('button[name="reset"]').click(this._onReset.bind(this));

    // Render preview
    /* {
      const canvas = this.element.find(".tooltip-preview")[0];
      const ctx = canvas.getContext("2d");

      const d = this._cachedData;
      const p = d.preview;
      const w = p.width;
      const h = p.height;

      // Clear canvas to black
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, w, h);

      // Draw tooltip preview
      ctx.strokeStyle = "white";
      ctx.strokeRect(20, 20, 80, 80);
    } */
  }

  _handleImmediateChange(event) {
    const el = event.currentTarget;
    const key = el.name;
    if (!key) return;

    let value;
    if (el.tagName.toUpperCase() === "INPUT") {
      value = el.value;
      if (el.type === "checkbox") value = el.checked === true ? true : false;
    } else {
      value = el.innerHTML;
    }
    if (el.dataset?.dtype === "Boolean") value = Boolean(value);
    else if (el.dataset?.dtype === "Number") value = parseFloat(value);

    setProperty(this._cachedData, `data.${key}`, value);
    this.render();
  }

  _openWorldSettings(event) {
    if (!game.user.isGM) {
      ui.notifications.error("PF1.ErrorGenericPermission");
      return;
    }

    new TooltipWorldConfig().render(true);
  }

  async _onReset(event) {
    event.preventDefault();
    await game.settings.set("pf1", "tooltipConfig", this.constructor.defaultSettings);
    this._cachedData = null;
    ui.notifications.info(game.i18n.localize("PF1.TooltipConfigResetInfo"));
    return this.render();
  }

  async _updateObject(event, formData) {
    const settings = expandObject(formData);

    await game.settings.set("pf1", "tooltipConfig", settings);
    ui.notifications.info(game.i18n.localize("PF1.TooltipConfigUpdateInfo"));
  }
}
