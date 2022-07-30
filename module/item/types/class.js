import { ItemPF } from "../entity.js";
import { createTag } from "../../lib.js";
import { RollPF } from "../../roll.js";

export class ItemClassPF extends ItemPF {
  async _preUpdate(update, context, userId) {
    await super._preUpdate(update, context, userId);

    // Set level marker
    if (hasProperty(update, "system.level")) {
      this._prevLevel = this.system.level;
    }
  }

  async update(data, context = {}) {
    await super.update(data, context);

    // Update class
    const newLevel = data["system.level"] || getProperty(data, "system.level");
    if (newLevel !== undefined && this.parent) {
      const prevLevel = this._prevLevel;
      if (prevLevel !== undefined) {
        delete this._prevLevel;
        await this._onLevelChange(prevLevel, newLevel);
      }
    }
  }

  async delete(context = {}) {
    await this._onLevelChange(this.system.level, 0);
    return super.delete(context);
  }

  async _onLevelChange(curLevel, newLevel) {
    if (!this.parent) return;
    const actor = this.parentActor;

    // Add items associated to this class
    if (newLevel > curLevel) {
      const classAssociations = (getProperty(this, "system.links.classAssociations") || []).filter((o, index) => {
        o.__index = index;
        return o.level > curLevel && o.level <= newLevel;
      });

      const newItems = [];
      for (const co of classAssociations) {
        const collection = co.id.split(".").slice(0, 2).join(".");
        const itemId = co.id.split(".")[2];
        const pack = game.packs.get(collection);
        const item = await pack.getDocument(itemId);
        if (!item) {
          const msg = `Could not find class association: ${co.id}`;
          console.warn(co.id, msg, this);
          ui.notifications?.warn(msg);
          continue;
        }

        // Apply Foundry's transformations for importing
        // This adds flags.core.sourceId, removes extraneous permissions, resets sorting, etc.
        const itemData = game.items.fromCompendium(item);

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
        const classUpdateData = { _id: this.id };
        updateData.push(classUpdateData);
        for (const i of items) {
          const co = i.getFlag("pf1", "__co");
          // Set class association flags
          classUpdateData[`flags.pf1.links.classAssociations.${i.id}`] = co.level;
          // Remove temporary flag
          updateData.push({ _id: i.id, "flags.pf1.-=__co": null });
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
    const itemData = this.system;
    // Reset cached HD/MT
    // Can't prepare here as the actor uses this info before item preparation is done.
    itemData.hitDice = undefined;
    itemData.mythicTier = undefined;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    const itemData = this.system;

    const useFractional = game.settings.get("pf1", "useFractionalBaseBonuses");

    // Prepare class base save
    {
      const saveFormulas = useFractional
        ? CONFIG.PF1.classFractionalSavingThrowFormulas
        : CONFIG.PF1.classSavingThrowFormulas;

      for (const save of Object.keys(CONFIG.PF1.savingThrows)) {
        const classType = itemData.classType || "base";
        let formula;
        const saveData = itemData.savingThrows[save];
        const saveType = saveData.value;
        if (saveType === "custom") {
          formula = saveData.custom || "0";
        } else {
          formula = saveFormulas[classType][saveType];
        }
        if (formula == null) formula = "0";
        const total = RollPF.safeRoll(formula, { level: itemData.level, hitDice: this.hitDice }).total;
        saveData.base = total;
        if (useFractional) saveData.good = saveFormulas[classType].goodSave === true && saveType === "high";
      }
    }

    // Prepare BAB
    {
      const babFormulas = useFractional ? CONFIG.PF1.classFractionalBABFormulas : CONFIG.PF1.classBABFormulas;

      const babType = itemData.bab;
      let formula;
      if (babType === "custom") {
        formula = itemData.babFormula || "0";
      } else {
        formula = babFormulas[babType] || "0";
      }
      itemData.babBase = RollPF.safeRoll(formula, { level: itemData.level, hitDice: this.hitDice }).total;
    }

    // Feed info back to actor
    const actor = this.actor;
    // Test against actor.data to avoid unlinked token weirdness
    if (actor?.system) {
      const actorData = actor.system,
        classData = this.system;

      let tag = classData.tag;
      if (!tag) tag = createTag(this.name);

      let healthConfig = game.settings.get("pf1", "healthConfig");
      const hasPlayerOwner = this.hasPlayerOwner;
      healthConfig =
        classData.classType === "racial"
          ? healthConfig.hitdice.Racial
          : hasPlayerOwner
          ? healthConfig.hitdice.PC
          : healthConfig.hitdice.NPC;

      if (!classData.classType) console.warn(`${this.name} lacks class type`, this);
      const isBaseClass = (classData.classType || "base") === "base";
      actor.classes[tag] = {
        level: classData.level,
        name: this.name,
        hd: classData.hd,
        hitDice: this.hitDice,
        mythicTier: this.mythicTier,
        bab: classData.bab,
        hp: healthConfig.auto,
        savingThrows: {
          fort: classData.savingThrows.fort.base,
          ref: classData.savingThrows.ref.base,
          will: classData.savingThrows.will.base,
        },
        fc: {
          hp: isBaseClass ? classData.fc.hp.value : 0,
          skill: isBaseClass ? classData.fc.skill.value : 0,
          alt: isBaseClass ? classData.fc.alt.value : 0,
        },
      };
    }
  }

  get subType() {
    return this.system.classType;
  }

  get hitDice() {
    const itemData = this.system;
    if (itemData.hitDice === undefined) {
      if (itemData.customHD?.length > 0) {
        const rollData = { item: { level: this.system.level } };
        itemData.hitDice = RollPF.safeRoll(itemData.customHD, rollData).total;
      } else {
        itemData.hitDice = this.subType === "mythic" ? 0 : itemData.level;
      }
    }

    return itemData.hitDice;
  }

  get mythicTier() {
    const itemData = this.system;
    if (itemData.mythicTier === undefined) {
      itemData.mythicTier = this.subType === "mythic" ? itemData.level : 0;
    }
    return itemData.mythicTier;
  }
}
