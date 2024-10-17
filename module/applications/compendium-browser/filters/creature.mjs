import { CheckboxFilter } from "./checkbox.mjs";
import { CR } from "@utils";

export class CreatureCRFilter extends CheckboxFilter {
  static label = "PF1.ChallengeRatingShort";
  static indexField = "system.details.cr.base";
  static types = ["character", "npc"];

  /** @override */
  async prepareChoices() {
    await super.prepareChoices();

    const choices = this.choices.contents
      .map((choice) => Number(choice.key))
      .sort((a, b) => a - b)
      .map((cr) => {
        const label = CR.fromNumber(cr);
        return [cr.toString(), { key: cr, label: label }];
      });
    this.choices = new foundry.utils.Collection(choices);
  }
}
