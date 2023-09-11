Hooks.once("ready", async function registerPF1Tours() {
  game.tours.register(
    "pf1",
    "foundryExtensions",
    await SidebarTour.fromJSON("systems/pf1/tours/foundry-extensions.json")
  );
});
