export class ActorRestDialog extends BaseEntitySheet {
  static get defaultOptions() {
    const options = super.defaultOptions;
    return mergeObject(options, {
      id: "actor-flags",
      classes: ["pf1", "actor-rest"],
      template: "systems/pf1/templates/apps/actor-rest.html",
      width: 500,
      closeOnSubmit: true
    });
  }

  /* -------------------------------------------- */

  /**
   * Configure the title of the special traits selection window to include the Actor name
   * @type {String}
   */
  get title() {
    return `${game.i18n.localize('PF1.Rest')}: ${this.object.name}`;
  }

  /* -------------------------------------------- */

  /**
   * Update the Actor using the configured options
   * Remove/unset any flags which are no longer configured
   */
  async _updateObject(event, formData) {
    const actor = this.object;
    const actorData = actor.data.data;

    const restOptions = {
      restoreHealth: formData["restoreHealth"],
      longTermCare: formData["longTermCare"],
      restoreDailyUses: formData["restoreDailyUses"],
    };

    const proceed = await Hooks.call("actorRest", actor, restOptions);
    if (!proceed) return;

    const updateData = {};
    // Restore health and ability damage
    if (formData["restoreHealth"] === true) {
      const hd = actorData.attributes.hd.total;
      let heal = {
        hp: hd,
        abl: 1,
      };
      if (formData["longTermCare"] === true) {
        heal.hp *= 2;
        heal.abl *= 2;
      }

      updateData["data.attributes.hp.value"] = Math.min(actorData.attributes.hp.value + heal.hp, actorData.attributes.hp.max);
      updateData["data.attributes.hp.nonlethal"] = Math.max(0, (actorData.attributes.hp.nonlethal || 0) - heal.hp);
      for (let [key, abl] of Object.entries(actorData.abilities)) {
        let dmg = Math.abs(abl.damage);
        updateData[`data.abilities.${key}.damage`] = Math.max(0, dmg - heal.abl);
      }
    }

    let itemPromises = [];
    // Restore daily uses of spells, feats, etc.
    if (formData["restoreDailyUses"] === true) {
      for (let item of actor.items) {
        const itemData = item.data.data;

        if (itemData.uses && itemData.uses.per === "day" && itemData.uses.value !== itemData.uses.max) {
          const itemUpdateData = {
            "data.uses.value": itemData.uses.max,
          };
          itemPromises.push(item.update(itemUpdateData));
        }
        else if (item.type === "spell") {
          const spellbook = getProperty(actorData, `attributes.spells.spellbooks.${itemData.spellbook}`),
            isSpontaneous = spellbook.spontaneous;
          if (!isSpontaneous && itemData.preparation.preparedAmount < itemData.preparation.maxAmount) {
            const itemUpdateData = {
              "data.preparation.preparedAmount": itemData.preparation.maxAmount,
            };
            itemPromises.push(item.update(itemUpdateData));
          }
        }
      }

      // Restore spontaneous spellbooks
      for (let [key, spellbook] of Object.entries(actorData.attributes.spells.spellbooks)) {
        if (spellbook.spontaneous) {
          for (let sl of Object.keys(CONFIG.PF1.spellLevels)) {
            updateData[`data.attributes.spells.spellbooks.${key}.spells.spell${sl}.value`] = getProperty(actorData, `attributes.spells.spellbooks.${key}.spells.spell${sl}.max`);
          }
        }
      }
    }

    await Promise.all(itemPromises);
    return actor.update(updateData);
  }
}
