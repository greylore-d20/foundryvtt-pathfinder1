import { ActorPF } from "../entity.js";

export class ActorCharacterPF extends ActorPF {
  prepareBaseData() {
    super.prepareBaseData();

    const maxExp = this.getLevelExp(this.data.data.details.level.value);
    this.data.data.details.xp.max = maxExp;
  }

  prepareSpecificDerivedData() {
    super.prepareSpecificDerivedData();
  }
}
