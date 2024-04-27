// Add Vision Sharing sheet to ActorDirectory context options
Hooks.on("getActorDirectoryEntryContext", function sharedVision(html, menu) {
  menu.push({
    name: "PF1.Application.VisionSharing.Label",
    icon: '<i class="fas fa-eye"></i>',
    condition: () => game.user.isGM,
    callback: ([li]) =>
      game.actors.get(li.dataset.documentId)?.visionSharingSheet?.render(true, {
        focus: true,
        // Positioning copied from Foundry's ownership dialog
        top: Math.min(li.offsetTop, window.innerHeight - 350),
        left: window.innerWidth - 720,
      }),
  });
});

export class VisionSharingSheet extends ActorSheet {
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "vision-sharing"],
      template: "systems/pf1/templates/apps/vision-sharing.hbs",
      width: 400,
      height: "auto",
      closeOnSubmit: true,
      submitOnClose: false,
      submitOnChange: false,
      sheetConfig: false,
    };
  }

  get title() {
    let title = game.i18n.localize("PF1.Application.VisionSharing.Label") + `: ${this.actor.name}`;
    if (this.actor.token) title += "[" + game.i18n.localize("Token") + "]";
    return title;
  }

  async getData() {
    const context = {
      levels: {
        false: "PF1.No",
        true: "PF1.Yes",
      },
      users: game.users.players.reduce((rv, user) => {
        rv[user.id] = {
          user,
          level: null,
        };
        return rv;
      }, {}),
    };

    const config = this.actor.getFlag("pf1", "visionSharing");
    context.default = String(config?.default ?? false);
    if (config?.users) {
      Object.entries(config.users).forEach(([userId, level]) => (context.users[userId].level = String(level ?? null)));
    }

    return context;
  }

  _getHeaderButtons() {
    // HACK: Do not display import button
    return super._getHeaderButtons().filter((b) => b.class !== "import");
  }

  async _updateObject(event, formData) {
    formData = foundry.utils.expandObject(formData);

    // Clear users that are using default
    for (const [userId, level] of Object.entries(formData.users)) {
      if (level) formData.users[userId] = Boolean(level);
      else formData.users[`-=${userId}`] = null;
    }

    await this.actor.setFlag("pf1", "visionSharing", formData);
  }
}
