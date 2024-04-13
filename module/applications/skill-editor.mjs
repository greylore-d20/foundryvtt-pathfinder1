import { openJournal } from "../utils/lib.mjs";

export class SkillEditor extends FormApplication {
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
      closeOnSubmit: false,
      dragDrop: [{ dragSelector: null, dropSelector: "*" }],
      classes: [...options.classes, "pf1", "skill-editor"],
    };
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
    return pf1.config.skills[this.skillId] != null && !this.isSubSkill;
  }

  get skill() {
    if (this.isSubSkill) return this.actor.system.skills[this.skillId]?.subSkills[this.subSkillId];
    return this.actor.system.skills[this.skillId];
  }
  get skillName() {
    return this.isStaticSkill ? pf1.config.skills[this.skillId] : this.skill.name;
  }
  get skillTag() {
    if (this.isStaticSkill) return this.skillId;
    return this.isSubSkill ? this.subSkillId : this.skillId;
  }

  async getData(options) {
    const data = await super.getData(options);

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
    newData.journal ??= this.skill.journal;
    newData.custom ??= this.skill.custom;
    if (!this.isStaticSkill) {
      newData.background ??= this.skill.background;
    }

    // Basic sanity check
    if (!this.isStaticSkill && !tag) {
      return void ui.notifications.error(game.i18n.localize("PF1.ErrorEmptySkillTag"));
    }

    // Change application's id by tag
    if (tag) {
      if (this.isSubSkill) this.subSkillId = tag;
      else this.skillId = tag;
    }

    if (this.isSubSkill) {
      skillCoreUpdateData[this.skillId] = { subSkills: { [this.subSkillId]: newData } };
      if (!this.isStaticSkill && oldSubSkillId !== this.subSkillId) {
        // Delete old skill
        skillCoreUpdateData[this.skillId].subSkills[`-=${oldSubSkillId}`] = null;
        // Check for attempts to overwrite skills
        if (this.subSkillId in this.object.system.skills[this.skillId].subSkills) {
          return void ui.notifications.error(
            game.i18n.format("PF1.ErrorSkillTagAlreadyExists", { tag: `${this.skillId}.subSkills.${this.subSkillId}` })
          );
        }
      }
    } else {
      skillCoreUpdateData[this.skillId] = newData;
      if (!this.isStaticSkill && oldSkillId !== this.skillId) {
        // Delete old skill
        skillCoreUpdateData[`-=${oldSkillId}`] = null;
        // Check for attempts to overwrite skills
        if (this.skillId in this.object.system.skills) {
          return void ui.notifications.error(game.i18n.format("PF1.ErrorSkillTagAlreadyExists", { tag: this.skillId }));
        }
      }
    }

    await this.object.update(updateData);
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
    await this._onSubmit(event, { updateData: { "skill.journal": document.uuid } });
    await this.render();
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
      await this._onSubmit(event, { updateData: { "skill.journal": null } });
      await this.render();
    }
  }
}
