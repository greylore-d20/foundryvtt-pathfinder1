import { CreateNPCTour } from "./tours/create-npc.mjs";

Hooks.once("ready", async function registerPF1Tours() {
  // Create NPC
  game.tours.register("pf1", "createNPC", await CreateNPCTour.fromJSON("systems/pf1/tours/create-npc.json"));
});
