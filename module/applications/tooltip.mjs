export class TooltipPF extends Application {
  constructor() {
    super();

    this.mousePos = {
      x: 0,
      y: 0,
    };
    document.addEventListener("mousemove", (event) => {
      this.mousePos.x = event.clientX;
      this.mousePos.y = event.clientY;
      if (this.onMouse && !this.hidden) this._setPosition();
    });

    this.object = null;

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

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/hud/tooltip.hbs",
      popOut: false,
    });
  }

  get config() {
    return game.settings.get("pf1", "tooltipConfig");
  }

  get worldConfig() {
    return game.settings.get("pf1", "tooltipWorldConfig");
  }

  get anchor() {
    return this.config.anchor;
  }

  get offset() {
    return this.config.offset;
  }

  get onMouse() {
    return this.config.onMouse;
  }

  get hidden() {
    return this.element[0]?.style.visibility === "hidden";
  }

  bind(object) {
    if (this.lock.new) return;
    // If already stickied, don't replace it unless new sticky is tried.
    if (this.stickied && !this.sticky) return;
    this.object = object;
    if (this.sticky) this.stickied = true;
    this.render(true);
  }

  unbind(object) {
    if (this.lock.old) return;
    // Sticky current tooltip. Don't track current state fully to avoid being far too sensitive about it.
    if (this.sticky) this.stickied = true;
    // Keep stickied tooltips
    if (this.stickied) return;
    this.object = null;
    this.hide();
  }

  clearBind() {
    this.stickied = false;
    this.object = null;
    this.hide();
  }

  async getData() {
    if (typeof this.object === "string") {
      return { stringContent: this.object };
    } else if (this.object instanceof Token) {
      return {
        actorData: this.getTokenData(this.object),
      };
    } else if (this.object instanceof Actor) {
      return {
        actorData: this.getActorData(this.object),
      };
    }

    return {};
  }

  getTokenData(token) {
    const data = this.getActorData(token.actor);
    if (!data) return null;

    data.name = token.name;
    if (
      (game.user.isGM && this.forceHideGMInfo) ||
      (!game.user.isGM &&
        !token.actor.testUserPermission(
          game.user,
          this.worldConfig.minimumPermission ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED
        ))
    ) {
      const tooltipName = token.actor.system.details?.tooltip?.name || "";
      const hideName = token.actor.system.details?.tooltip?.hideName === true;
      // Hide name if explicitly set to hide or disposition does not match
      if (hideName || token.document.disposition <= this.worldConfig.hideActorNameByDisposition) {
        data.name = this.worldConfig.hideActorNameReplacement || "???";
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

  getActorData(actor) {
    if (!actor) return null;

    const data = {
      data: actor.system,
      name: actor.name,
    };

    if (!(game.user.isGM && !this.forceHideGMInfo)) {
      data.name = actor.system.details?.tooltip?.name || actor.name;
    }

    data.isOwner = game.user.isGM || actor.isOwner;
    if (!data.isOwner) data.name = "???";
    this.getPortrait(data, actor.img);

    // Get conditions
    if (
      (game.user.isGM && !this.forceHideGMInfo) ||
      actor.isOwner ||
      (!actor.system.details?.tooltip?.hideConditions && !this.worldConfig?.hideConditions)
    ) {
      const conditions = actor.system.conditions;
      for (const [conditionId, active] of Object.entries(conditions)) {
        if (active === true) {
          data.conditions = data.conditions || [];
          data.conditions.push({
            label: pf1.config.conditions[conditionId],
            icon: pf1.config.conditionTextures[conditionId],
          });
        }
      }
    }

    // Get buffs
    if (
      (game.user.isGM && !this.forceHideGMInfo) ||
      actor.isOwner ||
      (!actor.system.details?.tooltip?.hideBuffs && !this.worldConfig.hideBuffs)
    ) {
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
    if (
      (game.user.isGM && !this.forceHideGMInfo) ||
      actor.isOwner ||
      (!actor.system.details?.tooltip?.hideHeld && !this.worldConfig.hideHeld)
    ) {
      const held = actor.items.filter((i) => {
        if (!["weapon", "equipment"].includes(i.type)) return false;
        if (!i.system.equipped) return false;
        if (i.type === "equipment" && i.subType !== "shield") return false;
        return true;
      });

      for (const i of held) {
        data.held = data.held || [];
        data.held.push({
          label: i.getName(this.forceHideGMInfo),
          icon: i.img,
        });
      }
    }

    const equipment = actor.itemTypes.equipment?.filter((i) => i.system.equipped) ?? [];

    // Get armor
    if (
      (game.user.isGM && !this.forceHideGMInfo) ||
      actor.isOwner ||
      (!actor.system.details?.tooltip?.hideArmor && !this.worldConfig.hideArmor)
    ) {
      const armor = equipment.filter((i) => i.subType === "armor");

      for (const i of armor) {
        data.armor = data.armor || [];
        data.armor.push({
          label: i.getName(this.forceHideGMInfo),
          icon: i.img,
        });
      }
    }

    // Get clothing
    if (
      (game.user.isGM && !this.forceHideGMInfo) ||
      actor.isOwner ||
      (!getProperty(actor, "item.details.tooltip.hideClothing") && !this.worldConfig.hideClothing)
    ) {
      const clothing = equipment.filter((i) => i.subType === "clothing");

      for (const i of clothing) {
        data.clothing = data.clothing || [];
        data.clothing.push({
          label: i.getName(this.forceHideGMInfo),
          icon: i.img,
        });
      }
    }

    return data;
  }

  getPortrait(data, url) {
    if (this.config.portrait?.hide === true || this.worldConfig.portrait?.hide === true) return;

    data.portrait = {
      maxWidth: this.config.portrait?.maxSize?.width || 100,
      maxHeight: this.config.portrait?.maxSize?.height || 100,
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
        x: this.mousePos.x - position.width + position.width * this.anchor.x + this.offset.x,
        y: this.mousePos.y - position.height + position.height * this.anchor.y + this.offset.y,
      };
      position.left = Math.clamped(pos.x, minPos.x, maxPos.x);
      position.top = Math.clamped(pos.y, minPos.y, maxPos.y);
    } else {
      position.left = v.left + mw * this.anchor.x + this.offset.x;
      position.top = v.top + mh * this.anchor.y + this.offset.y;
    }

    this.element.css(position);
  }

  show() {
    if (!this.object) return;
    if (this.forceHide) return;
    if (this.config.disable === true || this.worldConfig.disable === true) return;

    if (!game.user.isGM && this.object.document.disposition === CONST.TOKEN_DISPOSITIONS.SECRET) return;

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
        if (loadedContentCount === loadableContentCount && this.object) {
          this._setPosition();
          this.show();
        }
      });
    } else if (this.object) {
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
        pf1.tooltip.bind(token);
      }
    }
    // Hide token tooltip
    else pf1.tooltip.unbind(token);
  }

  static toggle(enable) {
    if (enable) {
      if (!pf1.tooltip) {
        pf1.tooltip = new TooltipPF();
        Hooks.on("hoverToken", pf1.tooltip.tokenHover);
      }
      pf1.tooltip?.setPosition();
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
