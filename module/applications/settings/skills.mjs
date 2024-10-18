export class SkillPresetConfigModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      packs: new fields.ArrayField(new fields.StringField({ blank: false, nullable: false }), {
        initial: ["pf1.skills-core"],
        required: true,
      }),
    };
  }
}

export class SkillPresetConfig extends FormApplication {
  static get model() {
    return SkillPresetConfigModel;
  }

  preset = "custom";
  packs = [];

  constructor(options) {
    super(options);

    const config = this.getConfig();
    this.packs = config.packs;

    this.background = game.settings.get("pf1", "allowBackgroundSkills");

    // Figure out which preset is currently selected
    const presets = pf1.config.skillPresets;
    for (const [presetId, data] of Object.entries(presets)) {
      const packs = data.packs;
      if (packs.length !== config.packs.length) continue;
      if (data.background !== this.background) continue;
      if (packs.every((p) => config.packs.includes(p))) {
        this.preset = presetId;
        break;
      }
    }
  }

  getConfig() {
    return game.settings.get("pf1", "skills");
  }

  get template() {
    return "systems/pf1/templates/settings/skills.hbs";
  }

  get title() {
    return game.i18n.localize("PF1.SkillPresetConfig.Title");
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "pf1", "skill-config"],
      id: "pf1-skillset-configuration",
      height: "auto",
      width: 380,
      submitOnChange: true,
      submitOnClose: false,
      closeOnSubmit: false,
    };
  }

  get isEditable() {
    return game.user.isGM;
  }

  getData() {
    const getSourceLabel = (pack) => {
      switch (pack.metadata.packageType) {
        case "world":
          return game.world.title;
        case "system":
          return game.system.title;
        default:
          return game.modules.get(pack.metadata.packageName).title;
      }
    };

    const formatPack = (packId) => {
      const pack = game.packs.get(packId);
      if (!pack) {
        console.error(`Pack "${pack}" not found!`);
        return {
          id: packId,
          label: packId,
          missing: true,
        };
      }

      return {
        ...pack.metadata,
        id: packId,
        sourceLabel: getSourceLabel(pack),
      };
    };

    const builtin = this.preset !== "custom";
    let packOptions = [];

    if (!builtin) {
      packOptions = game.packs
        .filter(
          (p) =>
            p.metadata.type === "Item" && p.index.some((e) => e.type === "skill") && !this.packs.includes(p.metadata.id)
        )
        .map((p) => ({
          ...p.metadata,
          id: p.metadata.id,
          sourceLabel: getSourceLabel(p),
        }));
    }

    return {
      config: pf1.config,
      presets: pf1.config.skillPresets,
      preset: this.preset,
      background: this.background,
      builtin,
      packOptions,
      packs: this.packs.map(formatPack),
    };
  }

  /**
   * @override
   * @param {JQuery<HTMLElement>} jq
   */
  activateListeners(jq) {
    super.activateListeners(jq);

    jq.find(".controls a[data-action]").click(this._onAction.bind(this));

    jq.find(".buttons button[data-action]").click(this._onAction.bind(this));
  }

  /**
   * @protected
   * @param {Event} event
   */
  _onAction(event) {
    const action = event.target.dataset.action;
    switch (event.target.dataset.action) {
      case "remove": {
        const el = event.target.closest(".pack[data-pack]");
        const packId = el.dataset.pack;
        this.packs = this.packs.filter((p) => p !== packId);
        this.render();
        break;
      }
      case "save":
        game.settings.set("pf1", "skills", { packs: this.packs });
        game.settings.set("pf1", "allowBackgroundSkills", this.background);
        this.close();
        break;
      default:
        throw new Error(`Unrecognized action: ${action}`);
    }
  }

  /**
   * @override
   * @param {Event} event
   * @param {object} formData
   */
  _updateObject(event, formData) {
    formData = expandObject(formData);

    this.preset = formData.preset;

    if (this.preset === "custom") {
      this.packs = Object.values(formData.packs).filter((p) => !!p);
      this.background = formData.background ?? this.background ?? false;
    } else {
      const preset = pf1.config.skillPresets[this.preset];
      this.packs = preset.packs;
      this.background = preset.background ?? false;
    }

    this.render();
  }
}
