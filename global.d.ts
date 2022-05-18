import { ActorPF } from "./module/actor/entity";
import { ItemPF } from "./module/item/entity";
import { ChatMessagePF } from "./module/sidebar/chat-message";

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
