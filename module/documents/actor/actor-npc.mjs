import { ActorPF } from "./actor-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";

export class ActorNPCPF extends ActorPF {
  /**
   * @override
   * @param {object} data
   * @param {object} context
   * @param {User} user
   */
  async _preCreate(data, context, user) {
    await super._preCreate(data, context, user);

    const tokenUpdate = {};

    if (data.prototypeToken?.disposition === undefined) {
      const disposition = game.settings.get("pf1", "npcDisposition");
      if (disposition !== "NONE") {
        tokenUpdate.disposition = CONST.TOKEN_DISPOSITIONS[disposition];
      }
    }

    if (!foundry.utils.isEmpty(tokenUpdate)) {
      this.prototypeToken.updateSource(tokenUpdate);
    }
  }

  prepareBaseData() {
    super.prepareBaseData();
    this.system.details.cr.total = this.getCR(this.system);

    // Add base values for lite sheets
    this.system.attributes.init.total = this.system.attributes.init.value ?? 0;
    this.system.attributes.bab.total = this.system.attributes.bab.value ?? 0;
    this.system.attributes.cmd.total = this.system.attributes.cmd.value ?? 0;
    this.system.ac.normal.total = this.system.attributes.ac.normal.value ?? 0;
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

  /**
   * Get challegne rating.
   * Applies CR offset modifications from templates.
   *
   * @returns {number}
   */
  getCR() {
    const base = this.system.details?.cr?.base ?? 0;

    // Gather CR from templates
    const templates = this.itemTypes.feat.filter((item) => item.subType === "template" && item.isActive);

    return templates.reduce((cur, item) => {
      const crOffset = item.system.crOffset;
      if (crOffset) {
        cur += RollPF.safeRoll(crOffset, item.getRollData()).total;
      }
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
    return pf1.config.CR_EXP_LEVELS[cr];
  }
}
