import { ActorPF } from "./module/documents/actor/actor-pf.mjs";
import { ItemPF } from "./module/documents/item/item-pf.mjs";
import { ChatMessagePF } from "./module/documents/chat-message.mjs";

export {};

declare global {
  interface DocumentClassConfig {
    Actor: typeof ActorPF;
    Item: typeof ItemPF;
    ChatMessage: typeof ChatMessagePF;
  }
  interface LenientGlobalVariableTypes {
    game: unknown; // the type doesn't matter
    quench: unknown;
  }
}
