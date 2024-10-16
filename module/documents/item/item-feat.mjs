import { ItemPF } from "./item-pf.mjs";
import { renderCachedTemplate } from "@utils/handlebars/templates.mjs";
import { calculateRangeFormula } from "@utils";

/**
 * Feature item
 *
 * Class features, feats, traits, templates, racial traits, etc.
 */
export class ItemFeatPF extends ItemPF {
  /**
   * @internal
   * @override
   * @param {object} context
   * @param {User} userId
   */
  _onDelete(context, userId) {
    super._onDelete(context, userId);

    if (game.users.get(userId)?.isSelf) {
      if (this.isActive) {
        this.executeScriptCalls("toggle", { state: false });
      }
    }
  }

  /** @inheritDoc */
  async setActive(active, context) {
    return this.update({ "system.disabled": !active }, context);
  }

  /** @inheritDoc */
  get isActive() {
    return this.system.disabled !== true;
  }

  /** @inheritDoc */
  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });
    const { subType, abilityType } = this.system;

    labels.subType = pf1.config.featTypes[subType];
    labels.featType = pf1.config.featTypes[subType];

    labels.abilityType = pf1.config.abilityTypes[this.system.abilityType]?.short;
    if (this.subType === "trait") {
      labels.traitType = pf1.config.traitTypes[this.system.traitType];
    } else if (this.subType === "racial") {
      labels.raceType = pf1.config.raceTypes[this.system.traitType];
      labels.traitCategory = pf1.config.racialTraitCategories[this.system.traitCategory];
    }

    // Ability type
    if (abilityType && abilityType !== "none") {
      labels.abilityType = pf1.config.abilityTypes[abilityType].short;
      labels.abilityTypeLong = pf1.config.abilityTypes[abilityType].long;
    } else if (labels.abilityType) {
      delete labels.abilityType;
    }

    return labels;
  }

  /**
   * @inheritDoc
   */
  getDescription({ chatcard = false, data = {}, rollData, header = true, body = true, isolated = false } = {}) {
    const headerContent = header
      ? renderCachedTemplate("systems/pf1/templates/items/headers/effect-header.hbs", {
          ...data,
          ...this.getDescriptionData({ rollData, isolated }),
          chatcard: chatcard === true,
        })
      : "";

    let bodyContent = "";
    if (body) bodyContent = `<div class="description-body">` + this.system.description.value + "</div>";

    let separator = "";
    if (header && body) separator = `<h3 class="description-header">${game.i18n.localize("PF1.Description")}</h3>`;

    return headerContent + separator + bodyContent;
  }

  /**
   * @inheritdoc
   */
  getDescriptionData({ rollData, isolated = false } = {}) {
    const reSplit = pf1.config.re.traitSeparator;
    const srcData = this.system;
    const defaultAction = this.defaultAction;
    const actionData = defaultAction?.data ?? {};
    const system = this.system;

    rollData ??= defaultAction?.getRollData();
    const context = super.getDescriptionData({ rollData, isolated });
    context.labels = defaultAction?.getLabels({ rollData }) ?? this.getLabels({ rollData });
    context.system = system;

    return context;
  }

  /** @inheritDoc */
  getTypeChatData(data, labels, props, rollData) {
    super.getTypeChatData(data, labels, props, rollData);
    // Add ability type label
    if (labels.abilityType) {
      props.push(labels.abilityType);
    }
  }
}
