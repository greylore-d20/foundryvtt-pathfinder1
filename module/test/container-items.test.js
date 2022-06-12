import { createTestActor } from "./actor-utils.js";
import { fetchPackEntryData } from "./utils.js";

export const registerContainerItemTests = () => {
  quench.registerBatch(
    "pf1.container-items",
    async (context) => {
      const { describe, it, expect, before, after } = context;

      /**
       * Handles a shared context to pass between functions
       *
       * @type {object}
       */
      const shared = {};
      /** @type {import("../actor/entity.js").ActorPF} */
      let actor;
      const messages = [];
      const items = {};

      before(async () => {
        // Use permanent actor to allow testing regular item creation calls
        actor = await createTestActor({}, { temporary: false });
        shared.actor = actor;
      });
      after(async () => {
        await actor.delete();

        // Clean messages
        await CONFIG.ChatMessage.documentClass.deleteDocuments(messages.map((o) => o.id));
      });

      describe("basic container item", function () {
        before(async () => {
          items.container = await CONFIG.Item.documentClass.create(
            {
              name: "Some Container",
              type: "container",
            },
            { parent: actor }
          );
        });

        it("should be able to be added to an actor", async function () {
          expect(items.container instanceof CONFIG.Item.documentClasses.container).to.be.true;
        });
        it("should have an empty 'items' collection", async function () {
          expect(items.container.items instanceof Collection).to.be.true;
          expect(items.container.items.contents.length).to.equal(0);
        });
        it("should add no weight to actor", function () {
          expect(actor.data.data.attributes.encumbrance.carriedWeight).to.equal(0);
        });
        it("should render a sheet", async function () {
          await items.container.sheet._render(true);
          expect(items.container.sheet.rendered).to.be.true;
          items.container.sheet.close();
        });
      });

      describe("alchemist's fire in a container", function () {
        before(async () => {
          const itemData = await fetchPackEntryData("pf1.items", "Alchemist's Fire", true);
          itemData.data.quantity = 10;
          await items.container.createContainerContent(itemData, { raw: true });
          items.alchemistsFire = items.container.items.contents[0];
        });
        after(async () => {
          await items.container.deleteContainerContent(items.alchemistsFire);
        });

        it("should be able to be added to the container", async function () {
          expect(items.container.items.contents.length).to.equal(1);
          expect(items.alchemistsFire instanceof CONFIG.Item.documentClasses.weapon).to.be.true;
        });
        it("should add to the container's weight", function () {
          expect(items.container.data.data.weight).to.equal(10);
          expect(items.container.data.data.weight).to.equal(items.alchemistsFire.data.data.weight * 10);
        });
        it("should add the weight of the item to the actor", async function () {
          expect(actor.data.data.attributes.encumbrance.carriedWeight).to.equal(10);
        });
        it("should increase the container's value", function () {
          expect(items.container.getValue()).to.equal(100);
        });

        describe("should be usable from inside the container and", function () {
          let roll;
          before(async () => {
            roll = await items.alchemistsFire.useAttack({ skipDialog: true });
            messages.push(roll);
          });

          it("create a message", function () {
            expect(roll instanceof CONFIG.ChatMessage.documentClass).to.be.true;
          });
          it("have the right formula", function () {
            expect(roll.data.flags.pf1.metadata.rolls.attacks[0].attack.formula).to.equal("1d20 + 2[Dexterity]");
          });
          it("reduce its quantity by 1", function () {
            expect(items.alchemistsFire.data.data.quantity).to.equal(9);
          });
          it("reduce the container's weight", function () {
            expect(items.container.data.data.weight).to.equal(9);
          });
          it("and reduce the actor's weight", function () {
            expect(actor.data.data.attributes.encumbrance.carriedWeight).to.equal(9);
          });
        });

        describe("with weight reduction", function () {
          before(async () => {
            await items.alchemistsFire.update({ "data.quantity": 90 });
            await items.container.update({ "data.weightReduction": 50 });
          });

          it("should have the right quantity", function () {
            expect(items.alchemistsFire.data.data.quantity).to.equal(90);
          });

          /*
           * FIXME: The following two tests fail, as updating the container will reset its weight to 0.
           *  The bug is caused by `inventoryItems` only being available for weight calculations if they are updated.
           *  Swapping the order of update calls above would make the tests pass and conceal the bug in these tests.
           */
          it("should have the right weight", function () {
            expect(items.container.data.data.weight).to.equal(45);
          });
          it("should increase the actor's carried weight", function () {
            expect(actor.data.data.attributes.encumbrance.carriedWeight).to.equal(45);
          });
        });
      });
    },
    { displayName: "PF1.Container Items" }
  );
};
