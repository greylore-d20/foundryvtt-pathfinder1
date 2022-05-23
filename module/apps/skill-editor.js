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
    if (this.isSubSkill) return this.actor.data.data.skills[this.skillId]?.subSkills[this.subSkillId];
    return this.actor.data.data.skills[this.skillId];
  }
  get skillName() {
    return this.isStaticSkill ? CONFIG.PF1.skills[this.skillId] : this.skill.name;
  }

  /**
   * Get the alphabetized Documents which can be chosen as a configuration for the skill
   *
   * @param {WorldCollection} collection
   * @returns {object[]}
   * @private
   */
  _getDocuments(collection) {
    const documents = collection
      .filter((doc) => {
        return doc.testUserPermission(game.user, "LIMITED");
      })
      .map((doc) => {
        return { id: doc.id, name: doc.name };
      });
    documents.sort((a, b) => a.name.localeCompare(b.name));
    return documents;
  }

  async getData(options) {
    const data = super.getData(options);

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
    data.actorData = this.actor.data.toObject();

    // Referenced documents
    data.journals = this._getDocuments(game.journal);

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
}
