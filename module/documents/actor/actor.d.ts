interface RechargeActorItemsOptions
  extends Exclude<Partial<NonNullable<Parameters<pf1.documents.item.ItemPF["recharge"]>[0]>>, "commit"> {
  /**
   * If false, return update data object instead of directly updating the actor.
   *
   * @defaultValue `true`
   */
  commit?: boolean;
  /**
   * Update data to complement or read changed values from.
   *
   * @defaultValue `{}`
   */
  updateData: Record<string, unknown>;
}

/**
 * Raw skill data saved in actor.system.skills
 */
interface SkillData {
  ability: "str" | "dex" | "con" | "wis" | "int" | "cha";

  /** Whether or not Armor Check Penalty applies to this skill */
  acp: boolean;

  /** Whether or not this a background skill for the option Background Skills rule */
  background?: boolean;

  /** Whether or not this is a class skill */
  cs: boolean;

  /** Whether or not this is a custom skill */
  custom?: boolean;

  /** Compendium UID for this skill */
  journal?: string;

  /** The modifier for this skill */
  mod: number;

  /** Name for custom and child skills. Otherwise look up via pf1.config.skills[id].name */
  name?: string;

  rank: number;

  /** Requires training */
  rt: boolean;

  subSkills?: { [key: string]: SkillData };
}

/**
 * SkillInfo returned by actor.getSkillInfo()
 */
declare type SkillInfo = SkillData & {
  id: string;

  /**
   * Skill's full name which include's parent's name if applicable
   * e.g. Profession (Sailor)
   */
  fullName: string;

  /**
   * Info for that parent skill, if this is a sub-skill
   */
  parentSkill?: SkillInfo;
};
