// -------------------------------- //
// Quench Unit Testing              //
// -------------------------------- //

import { registerActorBaseTests } from "./actor.test.js";

export const registerTests = async () => {
  Hooks.on("quenchReady", async (quench) => {
    registerActorBaseTests(quench);
  });
};
