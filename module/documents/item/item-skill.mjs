import { ItemPF } from "./item-pf.mjs";
import { RollPF } from "module/dice/roll.mjs";

export class ItemSkillPF extends ItemPF {
  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  _preUpdate(changed, context, user) {
    super._preUpdate(changed, context, user);

    // No system data changed
    if (!changed.system) return;

    // Enforce identifier and grouping identifier are slugs
    if (changed.system.identifier) {
      changed.system.identifier = changed.system.identifier.slugify({ strict: true });
    }
    if (changed.system.grouping) {
      changed.system.grouping = changed.system.grouping.slugify({ strict: true });
    }
  }

  _grouping = null;
  /**
   * @type {ItemSkillPF} - Grouping skill
   */
  get grouping() {
    return this._grouping;
  }

  /** @type {Collection<string,ItemSkillPF>} - Sub-skills */
  subSkills = null;

  /**
   * @override
   */
  prepareBaseData() {
    super.prepareBaseData();

    // Pre-localize name
    this.name = game.i18n.localize(this.name);

    // Find grouping skill
    const parentId = this.system.grouping;
    if (parentId) {
      const allSkills = this.actor?.itemTypes.skill;
      const parent = allSkills?.find((skl) => skl.system.identifier === parentId) ?? null;
      if (!parent) console.warn(`Failed to find skill parent: ${parentId}`, this);
      this._grouping = parent;
    }

    this.subSkills = new Collection();

    // Init base values
    this.system.modifier = this.system.rank;
  }

  /**
   * @override
   */
  prepareDerivedData() {
    super.prepareDerivedData();

    const skl = this.system;

    // Prepare path
    skl.path = skl.identifier;

    // Prepare true path
    if (skl.grouping) {
      skl.path = `${skl.grouping}.${skl.identifier}`;
    }
    // Prepare grouping and true path
    const grouping = this.grouping;
    if (grouping) {
      skl.grouping = grouping.system.path;

      grouping.subSkills.set(skl.identifier, this);
    }

    // Add placeholder identifier if missing
    skl.identifier ||= this.name.slugify({ strict: true });

    if (!this.actor) {
      if (skl.class) {
        skl.modifier += pf1.config.classSkillBonus;
      }
    }
  }

  /**
   * Post actor prepareEmbedded Documents
   */
  postPrepare() {
    this.system.classSkill = this.isClassSkill;
  }

  /** @type {string} Full display name. */
  get displayName() {
    const parent = this.grouping;
    if (parent) return game.i18n.format("PF1.SubSkillName", { parent: parent.name, skill: this.name });
    return this.name;
  }

  /** @type {string} - Full identifier used for accessing this skill. */
  get fullIdentifier() {
    return this.system.path;
  }

  /** @type {boolean} Is class skill? */
  get isClassSkill() {
    return this.actor?.classSkills?.has(this.fullIdentifier) ?? false;
  }

  /** @type {boolean} Can have subskills? */
  get haveSubskills() {
    return this.system.subSkills ?? false;
  }

  /**
   * Roll a Skill Check
   *
   * @param {ActorRollOptions} [options={}]      Options which configure how the skill check is rolled
   * @returns {ChatMessage|object|void} The chat message if one was created, or its data if not. `void` if the roll was cancelled.
   * @throws {Error} - If insufficient permissions.
   */
  async use(options) {
    if (!this.isOwner) {
      ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: this.name }));
      throw new Error("Insufficient permissions to control actor.");
    }

    const skl = this.system;
    const skillId = skl.path;
    const parentSkl = this.grouping;

    const actor = this.actor;

    const rollData = options.rollData ?? this.getRollData();

    // Add contextual attack string
    const ident = skl.identifier;
    const noteObjects = this.getContextNotes(`skill.${ident}`);
    const parent = this.grouping;
    if (parent) noteObjects.push(...this.getContextNotes(`skill.${parent.identifier}`));
    const notes = this.formatContextNotes(noteObjects, rollData);

    // Add untrained note
    if (skl.rt && !skl.rank) {
      notes.push(game.i18n.localize("PF1.Untrained"));
    }

    // Gather changes
    const parts = [];
    const changes = actor.getHighestChanges(
      actor.changes.filter((c) => {
        const cf = actor.getChangeFlat.call(actor, c.subTarget, c.modifier);

        if (parentSkl && cf.includes(`system.skills.${parentSkl.system.path}.changeBonus`)) return true;
        return cf.includes(`system.skills.${skl.system.path}.changeBonus`);
      }),
      { ignoreTarget: true }
    );

    // Add ability modifier
    if (skl.ability) {
      parts.push(`@abilities.${skl.ability}.mod[${pf1.config.abilities[skl.ability]}]`);
    }

    // Add rank
    if (skl.rank > 0) {
      parts.push(`${skl.rank}[${game.i18n.localize("PF1.SkillRankPlural")}]`);

      const isClassSkill = this.isClassSkill;
      if (isClassSkill) {
        parts.push(`${pf1.config.classSkillBonus}[${game.i18n.localize("PF1.CSTooltip")}]`);
      }
    }

    // Add armor check penalty
    if (skl.acp && rollData.attributes.acp.total !== 0) {
      parts.push(`-@attributes.acp.total[${game.i18n.localize("PF1.ACPLong")}]`);
    }

    // Add Wound Thresholds info
    if (rollData.attributes.woundThresholds?.penalty > 0) {
      parts.push(
        `- @attributes.woundThresholds.penalty[${game.i18n.localize(
          pf1.config.woundThresholdConditions[rollData.attributes.woundThresholds.level]
        )}]`
      );
    }

    // Add changes
    for (const c of changes) {
      if (!c.value) continue;
      // Hide complex change formulas in parenthesis.
      if (typeof c.value === "string" && RollPF.parse(c.value).length > 1) {
        parts.push(`(${c.value})[${c.flavor}]`);
      } else {
        parts.push(`${c.value}[${c.flavor}]`);
      }
    }

    const props = [];
    if (notes.length > 0) props.push({ header: game.i18n.localize("PF1.Notes"), value: notes });

    const token = options.token ?? actor?.token;

    const rollOptions = {
      ...options,
      parts,
      rollData,
      flavor: game.i18n.format("PF1.SkillCheck", { skill: skl.name }),
      chatTemplateData: { hasProperties: props.length > 0, properties: props },
      compendium: { entry: pf1.config.skillCompendiumEntries[skl.path] ?? skl.journal, type: "JournalEntry" },
      subject: { skill: skl.path },
      speaker: ChatMessage.implementation.getSpeaker({ actor: this, token, alias: token?.name }),
    };

    if (Hooks.call("pf1PreActorRollSkill", this, rollOptions, this.skill.path) === false) return;
    const result = await pf1.dice.d20Roll(rollOptions);
    if (result) Hooks.callAll("pf1ActorRollSkill", this, result, this.skill.path);

    return result;
  }
}
