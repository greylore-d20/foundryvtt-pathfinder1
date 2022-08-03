export class SkillEditor extends FormApplication {
  constructor(actor, skillId, subSkillId, options = {}) {
    super(actor, options);
    this.skillId = skillId;
    this.subSkillId = subSkillId;

    this._callbacks = [];
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      width: 380,
      template: "systems/pf1/templates/apps/skill-editor.hbs",
      closeOnSubmit: true,
      dragDrop: [{ dragSelector: null, dropSelector: "*" }],
    });
  }
  get title() {
    return `${game.i18n.localize("PF1.EditSkill")}: ${this.skillName}`;
  }

  get actor() {
    return this.object;
  }

  get isSubSkill() {
    return this.subSkillId != null;
  }
  get isStaticSkill() {
    return CONFIG.PF1.skills[this.skillId] != null && !this.isSubSkill;
  }

  get skill() {
    if (this.isSubSkill) return this.actor.system.skills[this.skillId]?.subSkills[this.subSkillId];
    return this.actor.system.skills[this.skillId];
  }
  get skillName() {
    return this.isStaticSkill ? CONFIG.PF1.skills[this.skillId] : this.skill.name;
  }

  async getData(options) {
    const data = await super.getData(options);

    const isStaticSkill = this.isStaticSkill;

    // Configuration
    data.config = CONFIG.PF1;

    // Skill data
    data.skill = mergeObject(
      this.skill,
      {
        skillId: this.skillId,
        subSkillId: this.subSkillId,
        isSubSkill: this.isSubSkill,
        name: this.skillName,
        static: isStaticSkill,
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

    // Relocate skill data to what would fit within the actor's data structure
    const data = expandObject(formData);
    const skillData = mergeObject(this.skill, data.skill, { inplace: false });
    delete data.skill;
    if (this.isSubSkill) setProperty(data, `data.skills.${this.skillId}.subSkills.${this.subSkillId}`, skillData);
    else setProperty(data, `data.skills.${this.skillId}`, skillData);

    await this.object.update(data);
  }

  async close(...args) {
    await super.close(...args);

    this._callbacks.forEach((fn) => fn());
  }

  async _onDrop(event) {
    event.preventDefault();

    // Retrieve the dropped Journal Entry Page
    const data = TextEditor.getDragEventData(event);
    if (data.type !== "JournalEntryPage" && data.type !== "JournalEntry") return;
    const document = await CONFIG[data.type].documentClass.implementation.fromDropData(data);
    if (!document) return;

    // Add Journal Entry Page reference
    await this._updateObject(event, { "skill.journal": document.uuid });
    this.render();
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Open compendium page
    html.find(".compendium-entry").on("click", this._openCompendiumEntry.bind(this));
  }

  async _openCompendiumEntry(event) {
    event.preventDefault();
    const elem = event.currentTarget;

    // Gather data
    const uuid = elem.dataset.compendiumEntry;
    const document = await fromUuid(uuid);

    // Open document
    if (document instanceof JournalEntryPage) {
      document.parent.sheet.render(true, { pageId: document.id });
    } else {
      document.sheet.render(true);
    }
  }
}
