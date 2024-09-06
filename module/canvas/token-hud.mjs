import { TokenQuickActions } from "./token-quick-actions.mjs";

/**
 * Extension of core Token HUD
 *
 * @since PF1 vNEXT
 */
export class TokenHUDPF extends TokenHUD {
  _getStatusEffectChoices() {
    const core = super._getStatusEffectChoices(),
      buffs = {};

    const items = this.object.actor?.itemTypes.buff ?? [];
    for (const buff of items) {
      const id = `buff-${buff.id}`;
      buffs[id] = {
        _id: id, // to match v12
        id,
        title: buff.name,
        src: buff.img,
        isActive: buff.isActive,
        isOverlay: false,
        cssClass: buff.isActive ? "active" : "",
      };
    }

    return { ...core, ...buffs };
  }

  activateListeners(html) {
    super.activateListeners(html);

    pf1.canvas.TokenQuickActions.addQuickActions(this, html);
  }
}
