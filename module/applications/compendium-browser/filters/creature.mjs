import { BaseFilter } from "./base.mjs";

export class CreatureCRFilter extends BaseFilter {
  static label = "PF1.ChallengeRatingShort";
  static indexField = "system.details.cr.base";
  static types = ["character", "npc"];
}
