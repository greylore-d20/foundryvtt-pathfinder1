import { CreateNPCTour } from "./tours/create-npc.mjs";

Hooks.once("ready", async function registerPF1Tours() {
  // System utilities
  game.tours.register(
    "pf1",
    "foundryExtensions",
    await SidebarTour.fromJSON("systems/pf1/tours/foundry-extensions.json")
  );

  // Create NPC
  game.tours.register("pf1", "createNPC", await CreateNPCTour.fromJSON("systems/pf1/tours/create-npc.json"));
});
