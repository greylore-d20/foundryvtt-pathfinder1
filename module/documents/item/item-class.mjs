import { ItemPF } from "./item-pf.mjs";
import { createTag } from "../../utils/lib.mjs";
import { RollPF } from "../../dice/roll.mjs";
import { callOldNamespaceHookAll } from "@utils/hooks.mjs";

export class ItemClassPF extends ItemPF {
  async _preUpdate(update, context, userId) {
    await super._preUpdate(update, context, userId);

    // Set level marker
    if (update.system?.level !== undefined) {
      this._prevLevel = this.system.level;
    }
  }

  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if (userId !== game.user.id) return;
    const actor = this.parent;
    if (!actor) return;

    // Create spellbook if the class has spellcasting defined
    if (!this.system.casting?.type) return;
    const bookData = { ...this.system.casting, class: this.system.tag };
    actor.createSpellbook(bookData);
  }

  _onDelete(options, userId) {
    super._onDelete(options, userId);
    if (userId !== game.user.id) return;
    const actor = this.parent;
    if (!actor) return;

    // Disable book associated with this class, if it has spellcasting defined
    const tag = this.system.tag;
    if (!tag || !this.system.casting?.type) return;
    const books = actor.system.attributes.spells.spellbooks ?? {};
    const usedBook = Object.entries(books).find(([bookId, book]) => !!book.class && book.class === tag);
    if (usedBook === undefined) return;
    const [bookId, book] = usedBook;
    if (book.inUse) {
      actor.update({ [`system.attributes.spells.spellbooks.${bookId}.inUse`]: false });
    }
  }

  async update(updateData, context = {}) {
    // Ensure update data is always in expanded format instead of arbitrarily mixed or flattened depending on caller.
    updateData = expandObject(updateData);

    await super.update(updateData, context);

    // Update class
    const newLevel = updateData.system?.level;
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

  /**
   * Add or remove class associations on level change.
   *
   * @param {number} curLevel Current level, before the level change.
   * @param {number} newLevel New level, after the level change.
   */
  async _onLevelChange(curLevel, newLevel) {
    if (!this.parent) return;
    const actor = this.parentActor;

    // Add items associated to this class
    if (newLevel > curLevel) {
      const classAssociations = (this.system.links?.classAssociations ?? []).filter(
        (link, index) => link.level > curLevel && link.level <= newLevel
      );

      const sources = new Map();

      const newItems = [];
      for (const link of classAssociations) {
        const item = await fromUuid(link.uuid);
        if (!item) {
          const msg = `Could not find class association: ${link.uuid}`;
          console.warn(link.uuid, msg, this);
          ui.notifications?.warn(msg, { console: false });
          continue;
        }

        sources.set(link.uuid, link);

        // Apply Foundry's transformations for importing (automatically calls .toObject())
        // This adds flags.core.sourceId, removes extraneous permissions, resets sorting, etc.
        const itemData = game.items.fromCompendium(item);

        newItems.push({ data: itemData, link });
      }

      if (newItems.length) {
        const itemsCreationData = newItems.sort((a, b) => a.link.level - b.link.level).map((o) => o.data);
        // Put new items at end of their types
        const _typeSorting = {};
        for (const item of itemsCreationData) {
          _typeSorting[item.type] ??=
            actor.items.filter((i) => i.type === item.type).sort((a, b) => b.sort - a.sort)[0]?.sort ?? 0;
          _typeSorting[item.type] += CONST.SORT_INTEGER_DENSITY;
          item.sort = _typeSorting[item.type];
        }
        const items = await actor.createEmbeddedDocuments("Item", itemsCreationData);

        const classAssociations = {};
        const updateData = { flags: { pf1: { links: { classAssociations } } } };
        for (const item of items) {
          const link = sources.get(item.getFlag("core", "sourceId"));

          // Set class association flags
          classAssociations[item.id] = link?.level ?? 1;
        }

        await this.update(updateData, { render: false });
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
    callOldNamespaceHookAll("pf1.classLevelChange", "pf1ClassLevelChange", this.actor, this, curLevel, newLevel);
    Hooks.callAll("pf1ClassLevelChange", this.actor, this, curLevel, newLevel);
  }

  prepareBaseData() {
    super.prepareBaseData();
    const itemData = this.system;
    // Reset cached HD/MT
    // Can't prepare here as the actor uses this info before item preparation is done.
    itemData.hitDice = undefined;
    itemData.mythicTier = undefined;

    // Soft fill default casting details when missing
    if (itemData.casting?.type) {
      itemData.casting.progression ??= "high";
      itemData.casting.ability ??= "int";
      itemData.casting.spells ??= "arcane";
      itemData.casting.domainSlots ??= 1;
      itemData.casting.cantrips ??= true;
    }
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    const itemData = this.system;

    const useFractional = game.settings.get("pf1", "useFractionalBaseBonuses");

    // Prepare class base save
    {
      const saveFormulas = useFractional
        ? pf1.config.classFractionalSavingThrowFormulas
        : pf1.config.classSavingThrowFormulas;

      for (const save of Object.keys(pf1.config.savingThrows)) {
        const classType = itemData.subType || "base";
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
      const babFormulas = useFractional ? pf1.config.classFractionalBABFormulas : pf1.config.classBABFormulas;

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
        classData.subType === "racial"
          ? healthConfig.hitdice.Racial
          : hasPlayerOwner
          ? healthConfig.hitdice.PC
          : healthConfig.hitdice.NPC;

      if (!classData.subType) console.warn(`${this.name} lacks class type`, this);
      const isBaseClass = (classData.subType || "base") === "base";
      if (!this.actor.classes) return;
      actor.classes[tag] = {
        _id: this.id,
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

  /**
   * @remarks This item type can not be recharged.
   * @override
   */
  recharge() {
    return;
  }
}
