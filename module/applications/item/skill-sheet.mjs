export class SkillSheetPF extends ItemSheet {
  get title() {
    const actor = this.document.actor;
    if (actor) return this.document.displayName + ` – ${actor.name}`;
    return this.document.displayName;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "pf1", "sheet", "item", "skill"],
      template: "systems/pf1/templates/items/skill.hbs",
      dragDrop: [{ dropSelector: ".tab.details", dragSelector: ".link[data-link]" }],
    };
  }

  async getData() {
    /** @type {pf1.documents.item.ItemSkillPF} */
    const skl = this.document;

    const reference = skl.system.reference ? await fromUuid(skl.system.reference) : null;

    return {
      actor: skl.actor,
      item: skl,
      fullID: skl.fullIdentifier,
      name: skl.name,
      system: skl.system,
      reference,
      grouping: skl.grouping,
      config: pf1.config,
    };
  }

  /**
   * @override
   */
  _onSubmit(ev) {
    // Prevent submission if provided with invalid data
    let valid = true;
    for (const el of this.form.querySelectorAll("input")) {
      if (!el.reportValidity()) valid = false;
    }
    if (!valid) return null;

    return super._onSubmit(ev);
  }

  /**
   * By default, returns true only for GM
   *
   * @override
   */
  _canDragStart(selector) {
    return true;
  }

  /**
   * By default item sheets disallow all drops.
   *
   * @override
   */
  _canDragDrop(selector) {
    return this.isEditable;
  }

  async _onDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (e) {
      return false;
    }

    console.log(data);
    switch (data.type) {
      case "Item": {
        const item = await fromUuid(data.uuid);
        if (item.type !== "skill") throw new Error("Invalid drop received");
        if (item === this.document) throw new Error("Self-references not allowed");
        if (!item.system.identifier) throw new Error("Invalid identifier in dropped skill");
        this.document.update({ "system.grouping": item.system.identifier });
        break;
      }
      case "JournalEntry":
      case "JournalEntryPage":
        this.document.update({ "system.reference": data.uuid });
        break;
      default:
        throw new Error("Invalid drop received");
    }
  }

  /**
   * @override
   * @param {Event} event
   */
  async _onDragStart(event) {
    const el = event.target;
    if (el.matches(".link")) {
      const uuid = this.document.system.reference;
      const ref = await fromUuid(uuid);
      const transferData = {
        type: ref.documentName,
        uuid,
      };
      event.dataTransfer.setData("text/plain", JSON.stringify(transferData));
    } else {
      throw new Error("Unsupported drag source");
    }
  }

  async _onAction(event) {
    event.preventDefault();

    const el = event.target;
    const action = el.dataset.action;
    switch (action) {
      case "delete": {
        if (el.dataset.target === "reference") {
          // TODO: CONFIRM
          this.document.update({ "system.-=reference": null });
        }
        break;
      }
      case "open":
        if (el.dataset.link) {
          const doc = await fromUuid(el.dataset.link);
          doc.sheet.render(true);
        }
        break;
      default:
        throw new Error(`Invalid action: ${action}`);
    }
  }

  /**
   * @override
   * @param {JQuery<HTMLElement>} jq
   */
  activateListeners(jq) {
    super.activateListeners(jq);

    const html = jq[0];

    html.querySelectorAll("input").forEach((el) => {
      el.reportValidity();
    });

    // Bind action listeners
    html.querySelectorAll("a[data-action]").forEach((el) => el.addEventListener("click", this._onAction.bind(this)));
  }
}
