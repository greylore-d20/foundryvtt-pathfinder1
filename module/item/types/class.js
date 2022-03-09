import { ItemPF } from "../entity.js";

export class ItemClassPF extends ItemPF {
  async delete(context = {}) {
    await this._onLevelChange(this.data.data.level, 0);
    return super.delete(context);
  }

  async _onLevelChange(curLevel, newLevel) {
    if (!this.parent) return;
    const actor = this.parentActor;

    // Add items associated to this class
    if (newLevel > curLevel) {
      const classAssociations = (getProperty(this.data, "data.links.classAssociations") || []).filter((o, index) => {
        o.__index = index;
        return o.level > curLevel && o.level <= newLevel;
      });

      const newItems = [];
      for (const co of classAssociations) {
        const collection = co.id.split(".").slice(0, 2).join(".");
        const itemId = co.id.split(".")[2];
        const pack = game.packs.get(collection);
        const item = await pack.getDocument(itemId);

        const itemData = duplicate(item.data);

        // Set temporary flag
        setProperty(itemData, "flags.pf1.__co.level", duplicate(co.level));

        delete itemData._id;
        newItems.push({ data: itemData, co: co });
      }

      if (newItems.length) {
        const items = await actor.createEmbeddedDocuments(
          "Item",
          newItems.map((o) => o.data)
        );

        const updateData = [];
        const classUpdateData = { _id: this.data._id };
        updateData.push(classUpdateData);
        for (const i of items) {
          const co = i.getFlag("pf1", "__co");
          // Set class association flags
          classUpdateData[`flags.pf1.links.classAssociations.${i.id}`] = co.level;
          // Remove temporary flag
          updateData.push({ _id: i.data._id, "flags.pf1.-=__co": null });
        }
        if (updateData.length) {
          await actor.updateEmbeddedDocuments("Item", updateData);
        }
      }
    }

    // Remove items associated to this class
    if (newLevel < curLevel) {
      const associations = duplicate(this.getFlag("pf1", "links.classAssociations") || {});
      const itemIds = [];
      for (const [id, level] of Object.entries(associations)) {
        const item = this.parent.items.get(id);
        if (!item) {
          delete associations[id];
          continue;
        }

        if (level > newLevel) {
          itemIds.push(item.id);
          delete associations[id];
        }
      }
      await this.setFlag("pf1", "links.classAssociations", associations);
      await Item.implementation.deleteDocuments(itemIds, { parent: this.parent });
    }

    // Call level change hook
    Hooks.call("pf1.classLevelChange", this.actor, this, curLevel, newLevel);
  }

  prepareBaseData() {
    super.prepareBaseData();
    const itemData = this.data.data;
    // Reset cached HD/MT
    // Can't prepare here as the actor uses this info before item preparation is done.
    itemData.hitDice = undefined;
    itemData.mythicTier = undefined;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    const itemData = this.data.data;

    const useFractional = game.settings.get("pf1", "useFractionalBaseBonuses");


    // Prepare class base save
    for (const save of Object.keys(CONFIG.PF1.savingThrows)) {
      const classType = itemData.classType || "base";
      let formula;
      const saveType = itemData.savingThrows[save].value;
      if (saveType === "custom") {
        formula = itemData.savingThrows[save].custom || "0";
      } else {
        formula = CONFIG.PF1.classSavingThrowFormulas[classType][saveType];
      }
      if (formula == null) formula = "0";
      const total = Math.floor(RollPF.safeRoll(formula, { level: itemData.level, hitDice: this.hitDice }).total);
      itemData.savingThrows[save].base = total;
    }
  }

  get subType() {
    return this.data.data.classType;
  }

  get hitDice() {
    const itemData = this.data.data;
    if (itemData.hitDice === undefined) {
      if (itemData.customHD?.length > 0) {
        const rollData = { item: { level: this.data.data.level } };
        itemData.hitDice = RollPF.safeRoll(itemData.customHD, rollData).total;
      } else {
        itemData.hitDice = this.subType === "mythic" ? 0 : itemData.level;
      }
    }

    return itemData.hitDice;
  }

  get mythicTier() {
    const itemData = this.data.data;
    if (itemData.mythicTier === undefined) {
      itemData.mythicTier = this.subType === "mythic" ? itemData.level : 0;
    }
    return itemData.mythicTier;
  }
}
