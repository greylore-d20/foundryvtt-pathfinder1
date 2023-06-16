import * as _pf1 from "./pf1.mjs";

export {};

declare global {
  export import pf1 = _pf1;

  // Document classes
  export import ActorPF = pf1.documents.actor.ActorPF;
  export import ItemPF = pf1.documents.item.ItemPF;
  export import ChatMessagePF = pf1.documents.ChatMessagePF;
  export import TokenDocumentPF = pf1.documents.TokenDocumentPF;
  export import ActiveEffectPF = pf1.documents.ActiveEffectPF;
  export import CombatPF = pf1.documents.CombatPF;

  // Component classes
  export import ItemChange = pf1.components.ItemChange;
  export import ItemAction = pf1.components.ItemAction;

  // Canvas classes
  export import TokenPF = pf1.canvas.TokenPF;
  export import MeasuredTemplatePF = pf1.canvas.MeasuredTemplatePF;

  // Roll-related classes
  export import RollPF = pf1.dice.RollPF;

  // UI classes
  export import TooltipPF = pf1.applications.TooltipPF;

  interface DocumentClassConfig {
    // Documents
    // Actor and Item types are not technically correct, as they are not the base classes.
    // They are however the base class for system-specific classes, and provide easier access to system-specific autocomplete.
    Actor: typeof pf1.documents.actor.ActorPF;
    Item: typeof pf1.documents.item.ItemPF;
    ChatMessage: typeof pf1.documents.ChatMessagePF;
    TokenDocument: typeof pf1.documents.TokenDocumentPF;
  }

  interface LenientGlobalVariableTypes {
    game: unknown; // the type doesn't matter
    quench: unknown;
  }
}
