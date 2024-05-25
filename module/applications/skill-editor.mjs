import { openJournal } from "../utils/lib.mjs";

export class SkillEditor extends DocumentSheet {
  constructor(actor, skillId, subSkillId, options = {}) {
    super(actor, options);
    this.skillId = skillId;
    this.subSkillId = subSkillId;

    this._callbacks = [];
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      width: 380,
      template: "systems/pf1/templates/apps/skill-editor.hbs",
      dragDrop: [{ dragSelector: null, dropSelector: "*" }],
      classes: [...options.classes, "pf1", "skill-editor"],
      submitOnChange: true,
      closeOnSubmit: false,
      submitOnClose: false,
    };
  }

  get title() {
    return `${game.i18n.localize("PF1.EditSkill")}: ${this.skillName} – ${this.actor.name}`;
  }

  /** @type {ActorPF} */
  get actor() {
    return this.document;
  }

  /** @type {boolean} */
  get isSubSkill() {
    return !!this.subSkillId;
  }

  /** @type {boolean} */
  get isStaticSkill() {
    return pf1.config.skills[this.skillId] != null && !this.isSubSkill;
  }

  /** @type {object} */
  get skill() {
    if (this.isSubSkill) return this.actor.system.skills[this.skillId]?.subSkills[this.subSkillId];
    return this.actor.system.skills[this.skillId];
  }

  /** @type {string} */
  get skillName() {
    return this.isStaticSkill ? pf1.config.skills[this.skillId] : this.skill.name;
  }

  /** @type {string} */
  get skillTag() {
    if (this.isStaticSkill) return this.skillId;
    return this.isSubSkill ? this.subSkillId : this.skillId;
  }

  async getData() {
    const data = await super.getData();

    // Configuration
    data.config = pf1.config;

    // Skill data
    data.skill = foundry.utils.mergeObject(
      this.skill,
      {
        skillId: this.skillId,
        subSkillId: this.subSkillId,
        isSubSkill: this.isSubSkill,
        name: this.skillName,
        static: this.isStaticSkill,
        tag: this.skillTag,
      },
      { inplace: false }
    );

    // Actor data
    data.actorData = this.actor.toObject();

    // Referenced documents
    try {
      const document = await fromUuid(data.skill.journal);
      data.journal = document.toObject();
      data.journal.uuid = data.skill.journal;
      data.journal.documentType = document instanceof JournalEntryPage ? "JournalEntryPage" : "JournalEntry";
    } catch (err) {
      data.journal = null;
    }

    return data;
  }

  addCallback(fn) {
    this._callbacks.push(fn);
  }

  async _updateObject(event, formData) {
    event.preventDefault();

    // Setup base update data
    const updateData = { system: { skills: {} } };
    const skillCoreUpdateData = updateData.system.skills;

    formData = foundry.utils.expandObject(formData);
    // Forcibly slugify provided tag to ensure it is not invalid (e.g. contain periods)
    const tag = formData.tag?.slugify({ strict: true });
    const newData = formData.skill;

    // Track old IDs for rename related data deletion
    const oldSubSkillId = this.subSkillId,
      oldSkillId = this.skillId;

    // Preserve some data
    if (newData.journal === undefined) newData.journal ??= this.skill.journal;
    if (newData.custom === undefined) newData.custom ??= this.skill.custom;

    if (!this.isStaticSkill) {
      newData.background ??= this.skill.background;
    }

    // Basic sanity check
    if (!this.isStaticSkill && !tag) {
      return void ui.notifications.error(game.i18n.localize("PF1.Error.EmptySkillTag"));
    }

    const subSkillId = this.isSubSkill ? tag : null;
    const skillId = !this.isSubSkill ? tag : this.skillId;

    // Detect skill ID conflicts
    const tagChanged = this.isSubSkill ? tag !== this.subSkillId : tag !== this.skillId;
    if (tagChanged) {
      const skillsData = this.isSubSkill ? this.actor.system.skills[skillId].subSkills : this.actor.system.skills;
      if (tag in skillsData) {
        const msgOpts = { tag: this.isSubSkill ? `${this.skillId}.subSkills.${tag}` : tag };
        return void ui.notifications.error(game.i18n.format("PF1.Error.SkillTagAlreadyExists", msgOpts));
      }
    }

    // Change application's id by tag
    if (tag) {
      if (this.isSubSkill) this.subSkillId = tag;
      else this.skillId = tag;
    }

    if (this.isSubSkill) {
      skillCoreUpdateData[skillId] = { subSkills: { [subSkillId]: newData } };
      // Delete old skill
      if (tagChanged) skillCoreUpdateData[skillId].subSkills[`-=${oldSubSkillId}`] = null;
    } else {
      skillCoreUpdateData[skillId] = newData;
      // Delete old skill
      if (tagChanged) skillCoreUpdateData[`-=${oldSkillId}`] = null;
    }

    return this.actor.update(updateData);
  }

  async close(...args) {
    await super.close(...args);

    this._callbacks.forEach((fn) => fn());
  }

  /**
   * @override
   */
  _canDragDrop() {
    // Allow non-GM to drop links as appropriate.
    return this.isEditable;
  }

  async _onDrop(event) {
    // Retrieve the dropped Journal Entry Page
    const data = TextEditor.getDragEventData(event);
    if (data.type !== "JournalEntryPage" && data.type !== "JournalEntry") return;
    const document = await CONFIG[data.type].documentClass.implementation.fromDropData(data);
    if (!document) return;

    this._updateObject(event, this._getSubmitData({ "skill.journal": document.uuid }));
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Open compendium page
    html.find(".compendium-page").on("click", this._openCompendiumEntry.bind(this));
    html.find(".compendium-controls a").on("click", this._onCompendiumControls.bind(this));

    // Submit
    html.find(`button[type="submit"]`).on("click", (event) => {
      event.preventDefault();
      const valid = this.element[0].querySelector("form").reportValidity();
      if (valid) this.close({ submit: true });
    });
  }

  async _openCompendiumEntry(event) {
    event.preventDefault();
    const elem = event.currentTarget.closest(".compendium-entry");

    openJournal(elem.dataset.compendiumEntry);
  }

  async _onCompendiumControls(event) {
    event.preventDefault();
    const elem = event.currentTarget;

    if (elem.classList.contains("delete")) {
      return this._updateObject(event, this._getSubmitData({ "skill.journal": null }));
    }
  }
}
