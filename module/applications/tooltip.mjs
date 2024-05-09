export class TooltipPF extends Application {
  constructor() {
    super();

    this.mousePos = {
      x: 0,
      y: 0,
    };

    document.addEventListener(
      "pointermove",
      (event) => {
        this.mousePos.x = event.clientX;
        this.mousePos.y = event.clientY;
        if (this.onMouse && !this.hidden) this._setPosition();
      },
      { passive: true }
    );

    /** @type {TokenDocument|null} */
    this.token = null;

    this.forceHideGMInfo = false;
    this.forceHide = false;
    this.sticky = false;
    /**
     * Has stickied tooltip. Prevent replacing tooltip.
     */
    this.stickied = false;

    this.lock = {
      new: false,
      old: false,
    };
  }

  /** @type {TokenDocument|null} */
  get token() {
    return this.object;
  }

  set token(token) {
    this.object = token;
  }

  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      template: "systems/pf1/templates/hud/tooltip.hbs",
      popOut: false,
    };
  }

  get clientConfig() {
    return game.settings.get("pf1", "tooltipConfig");
  }

  get worldConfig() {
    return game.settings.get("pf1", "tooltipWorldConfig");
  }

  get actorConfig() {
    return this.token?.actor?.system.details?.tooltip ?? {};
  }

  get onMouse() {
    return this.clientConfig.onMouse;
  }

  get hidden() {
    return this.element[0]?.style.visibility === "hidden";
  }

  /**
   * @param {TokenDocument} token
   */
  bind(token) {
    if (!game.user.isGM && token.disposition === CONST.TOKEN_DISPOSITIONS.SECRET) return;

    if (this.lock.new) return;
    // If already stickied, don't replace it unless new sticky is tried.
    if (this.stickied && !this.sticky) return;
    this.token = token;
    if (this.sticky) this.stickied = true;
    this.render(true);
  }

  /**
   * @param {TokenDocument} token
   */
  unbind(token) {
    if (token !== this.token) return;

    if (this.lock.old) return;
    // Sticky current tooltip. Don't track current state fully to avoid being far too sensitive about it.
    if (this.sticky) this.stickied = true;
    // Keep stickied tooltips
    if (this.stickied) return;
    this.token = null;
    this.hide();
  }

  clearBind() {
    this.stickied = false;
    this.token = null;
    this.hide();
  }

  async getData() {
    return {
      actorData: this.getTokenData(),
    };
  }

  getTokenData() {
    const data = this.getActorData();
    if (!data) return null;

    const token = this.token;
    const isGM = game.user.isGM;

    const worldConfig = this.worldConfig;

    const allow = isGM
      ? this.forceHideGMInfo
      : !token.actor.testUserPermission(game.user, worldConfig.minimumPermission);

    if (allow) {
      const actorConfig = this.actorConfig;
      const tooltipName = actorConfig.name || "";
      const hideName = actorConfig.hideName === true;
      // Hide name if explicitly set to hide or disposition does not match
      if (hideName || token.disposition <= worldConfig.hideActorNameByDisposition) {
        data.name = worldConfig.hideActorNameReplacement || "???";
      }
      // Otherwise display custom name if configured
      else if (tooltipName) {
        data.name = tooltipName;
      }
      // Otherwise display token name as normal
      else {
        data.name = token.name;
      }
    }

    return data;
  }

  getActorData() {
    const token = this.token;
    const actor = token?.actor;
    if (!actor) return null;

    const data = {
      data: actor.system,
      name: token.name,
    };

    const isGM = game.user.isGM;

    const actorConfig = this.actorConfig;
    const worldConfig = this.worldConfig;

    // Combine the two configs into something effective
    const config = foundry.utils.deepClone(worldConfig);
    Object.entries(actorConfig).forEach(([key, value]) => (config[key] ||= value));

    data.isOwner = actor.isOwner;
    if (!data.isOwner) data.name = "???";
    this.getPortrait(data, actor.img);

    const fullInfo = isGM ? !this.forceHideGMInfo : actor.isOwner;

    // Get conditions
    if (fullInfo || !config.hideConditions) {
      const conditions = actor.system.conditions;
      for (const [conditionId, active] of Object.entries(conditions)) {
        if (active === true) {
          data.conditions = data.conditions || [];
          const condition = pf1.registry.conditions.get(conditionId);
          data.conditions.push({
            label: condition.name,
            icon: condition.texture,
          });
        }
      }
    }

    // Get buffs
    if (fullInfo || !config.hideBuffs) {
      const buffs = actor.itemTypes.buff?.filter((i) => i.isActive && !i.system.hideFromToken) ?? [];
      for (const b of buffs) {
        data.buffs = data.buffs || [];
        data.buffs.push({
          label: b.name,
          icon: b.img,
          level: b.system.level,
        });
      }
    }

    // Get held items
    if (fullInfo || !config.hideHeld) {
      const held = actor.items.filter((i) => {
        if (!["weapon", "equipment"].includes(i.type)) return false;
        if (!i.isActive) return false;
        if (i.type === "equipment" && i.subType !== "shield") return false;
        return true;
      });

      for (const i of held) {
        data.held = data.held || [];
        data.held.push({
          label: i.getName(!fullInfo),
          icon: i.img,
        });
      }
    }

    const equipment = actor.itemTypes.equipment?.filter((i) => i.isActive) ?? [];

    // Get armor
    if (fullInfo || !config.hideArmor) {
      const armor = equipment.filter((i) => i.subType === "armor");

      for (const i of armor) {
        data.armor = data.armor || [];
        data.armor.push({
          label: i.getName(!fullInfo),
          icon: i.img,
        });
      }
    }

    // Get clothing
    if (fullInfo || !config.hideClothing) {
      const clothing = equipment.filter((i) => i.subType === "clothing");

      for (const i of clothing) {
        data.clothing = data.clothing || [];
        data.clothing.push({
          label: i.getName(!fullInfo),
          icon: i.img,
        });
      }
    }

    return data;
  }

  getPortrait(data, url) {
    const clientConfig = this.clientConfig;
    if (clientConfig.portrait.hide === true || this.worldConfig.portrait.hide === true) return;

    data.portrait = {
      maxWidth: clientConfig.portrait?.maxSize?.width || 100,
      maxHeight: clientConfig.portrait?.maxSize?.height || 100,
      url: url,
    };
  }

  _setPosition() {
    if (!this.element[0]) return;

    const v = canvas.app.view.getBoundingClientRect();
    const elSize = this.element[0].getBoundingClientRect();
    const position = {
      width: elSize.width,
      height: elSize.height,
      left: 0,
      top: 0,
    };

    const sb = ui.sidebar.element[0].getBoundingClientRect();
    const mw = v.width - position.width - sb.width,
      mh = v.height - position.height;

    const clientConfig = this.clientConfig;
    const anchor = clientConfig.anchor;
    const offset = clientConfig.offset;

    // Calculate final position
    if (this.onMouse) {
      const minPos = {
        x: v.left,
        y: v.top,
      };
      const maxPos = {
        x: minPos.x + mw,
        y: minPos.y + mh,
      };
      const pos = {
        x: this.mousePos.x - position.width + position.width * anchor.x + offset.x,
        y: this.mousePos.y - position.height + position.height * anchor.y + offset.y,
      };
      position.left = Math.clamped(pos.x, minPos.x, maxPos.x);
      position.top = Math.clamped(pos.y, minPos.y, maxPos.y);
    } else {
      position.left = v.left + mw * anchor.x + offset.x;
      position.top = v.top + mh * anchor.y + offset.y;
    }

    this.element.css(position);
  }

  show() {
    const token = this.token;
    if (!token) return;
    if (this.forceHide) return;
    if (this.clientConfig.disable === true || this.worldConfig.disable === true) return;

    // Ensure tooltip is stickied
    if (this.sticky) this.stickied = true;

    this.element[0].classList.toggle("sticky", this.stickied);

    this.element.css("visibility", "visible");
  }

  hide() {
    this.element.css("visibility", "hidden");
  }

  async _render(force = false, options = {}) {
    await super._render(force, options);

    this.hide();

    // Required to re-align portraits
    const loadableContent = this.element.find("img");
    const loadableContentCount = loadableContent.length;
    if (loadableContentCount > 0) {
      let loadedContentCount = 0;
      loadableContent.one("load", () => {
        loadedContentCount++;
        if (loadedContentCount === loadableContentCount && this.token) {
          this._setPosition();
          this.show();
        }
      });
    } else if (this.token) {
      this._setPosition();
      this.show();
    }
  }

  activateListeners(html) {
    html.find(".controls .close").click(() => {
      this.clearBind();
    });
  }

  tokenHover(token, hovering) {
    // Show token tooltip
    if (hovering) {
      const p = pf1.tooltip.mousePos;
      const el = document.elementFromPoint(p.x, p.y);
      // This check is required to prevent hovering over tokens under application windows
      if (el?.id === "board") {
        pf1.tooltip.bind(token.document);
      }
    }
    // Hide token tooltip
    else pf1.tooltip.unbind(token.document);
  }

  static toggle(enable) {
    if (enable) {
      if (!pf1.tooltip) {
        pf1.tooltip = new TooltipPF();
        Hooks.on("hoverToken", pf1.tooltip.tokenHover);
      }
      pf1.tooltip.setPosition();
    } else {
      if (pf1.tooltip) {
        Hooks.off("hoverToken", pf1.tooltip.tokenHover);
        pf1.tooltip = null;
      }
    }
  }

  async refresh() {
    await this.render();

    if (this.forceHide) this.hide();
    else this.show();
  }
}
