import { PF1 } from "@config";
import { ActorPF } from "./actor-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";

export class ActorNPCPF extends ActorPF {
  prepareBaseData() {
    super.prepareBaseData();
    this.system.details.cr.total = this.getCR(this.system);

    // Add base initiative (for NPC Lite sheets)
    this.system.attributes.init.total = this.system.attributes.init.value;
  }

  prepareSpecificDerivedData() {
    super.prepareSpecificDerivedData();

    // Reset CR
    setProperty(this.system, "details.cr.total", this.getCR());

    // Reset experience value
    let newXP = 0;
    try {
      const crTotal = this.system.details?.cr?.total || 0;
      newXP = this.getCRExp(crTotal);
    } catch (e) {
      newXP = this.getCRExp(1);
    }
    setProperty(this.system, "details.xp.value", newXP);
  }

  hasArmorProficiency(item, proficiencyName) {
    // Assume NPCs to be proficient with their armor
    return game.settings.get("pf1", "npcProficiencies") ? super.hasArmorProficiency(item, proficiencyName) : true;
  }

  /* Not used by NPCs */
  _updateExp() {}

  getCR() {
    if (this.type !== "npc") return 0;
    const data = this.system;

    const base = data.details.cr.base;
    if (this.items == null) return base;

    // Gather CR from templates
    const templates = this.items.filter(
      (o) => o.type === "feat" && o.system.subType === "template" && !o.system.disabled
    );
    return templates.reduce((cur, o) => {
      const crOffset = o.system.crOffset;
      if (typeof crOffset === "string" && crOffset.length)
        cur += RollPF.safeRoll(crOffset, this.getRollData(data)).total;
      return cur;
    }, base);
  }

  /**
   * Return the amount of experience granted by killing a creature of a certain CR.
   *
   * @param cr {null | number}     The creature's challenge rating
   * @returns {number}       The amount of experience granted per kill
   */
  getCRExp(cr) {
    if (cr < 1.0) return Math.max(400 * cr, 0);
    return PF1.CR_EXP_LEVELS[cr];
  }
}
