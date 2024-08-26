import { CheckboxFilter } from "./checkbox.mjs";
import { naturalSort } from "@utils";

export class PackFilter extends CheckboxFilter {
  static label = "PF1.Compendium";
  static indexField = "__pack";

  /** @override */
  prepareChoices() {
    const entries = this.compendiumBrowser?.entries.contents;
    const usedPacks = this.compendiumBrowser?.packs
      ?.filter((pack) => entries.some((entry) => entry.__pack === pack.collection))
      .map((pack) => {
        const label = pack.metadata.label;
        return { key: pack.collection, label: game.i18n.has(label) ? game.i18n.localize(label) : label };
      });
    const orderedPacks = naturalSort(usedPacks, "label").map((pack) => [pack.key, pack]);
    this.choices = new foundry.utils.Collection(orderedPacks);
  }
}

export class TagFilter extends CheckboxFilter {
  static label = "PF1.Tags";
  static indexField = "system.tags";
}
