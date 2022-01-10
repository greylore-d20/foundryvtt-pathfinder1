import { ActorPF } from "../entity.js";

export class ActorNPCPF extends ActorPF {
  prepareBaseData() {
    super.prepareBaseData();
    this.data.data.details.cr.total = this.getCR(this.data.data);
  }

  prepareSpecificDerivedData() {
    super.prepareSpecificDerivedData();

    // Reset CR
    setProperty(this.data, "data.details.cr.total", this.getCR());

    // Reset experience value
    try {
      const crTotal = getProperty(this.data, "data.details.cr.total") || 0;
      setProperty(this.data, "data.details.xp.value", this.getCRExp(crTotal));
    } catch (e) {
      setProperty(this.data, "data.details.xp.value", this.getCRExp(1));
    }
  }

  getCR() {
    if (this.data.type !== "npc") return 0;
    const data = this.data.data;

    const base = data.details.cr.base;
    if (this.items == null) return base;

    // Gather CR from templates
    const templates = this.items.filter(
      (o) => o.type === "feat" && o.data.data.featType === "template" && !o.data.data.disabled
    );
    return templates.reduce((cur, o) => {
      const crOffset = o.data.data.crOffset;
      if (typeof crOffset === "string" && crOffset.length)
        cur += RollPF.safeRoll(crOffset, this.getRollData(data)).total;
      return cur;
    }, base);
  }
}
