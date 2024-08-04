const iteratives = [
  [1],
  [2],
  [3],
  [4],
  [5],
  [6, 1], // Iter
  [7, 2],
  [8, 3],
  [9, 4],
  [10, 5],
  [11, 6, 1], // Iter
  [12, 7, 2],
  [13, 8, 3],
  [14, 9, 4],
  [15, 10, 5],
  [16, 11, 6, 1], // Iter
  [17, 12, 7, 2],
  [18, 13, 8, 3],
  [19, 14, 9, 4],
  [20, 15, 10, 5],
];

const flurryProg = [
  [-1, -1], // TWF
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4, -1], // Iter
  [5, 5, 0],
  [6, 6, 1, 1], // ITWF
  [7, 7, 2, 2],
  [8, 8, 3, 3],
  [9, 9, 4, 4, -1], // Iter
  [10, 10, 5, 5, 0],
  [11, 11, 6, 6, 1],
  [12, 12, 7, 7, 2],
  [13, 13, 8, 8, 3, 3], // GTWF
  [14, 14, 9, 9, 4, 4, -1], // Iter
  [15, 15, 10, 10, 5, 5, 0],
  [16, 16, 11, 11, 6, 6, 1],
  [17, 17, 12, 12, 7, 7, 2],
  [18, 18, 13, 13, 8, 8, 3],
];

const unflurryProg = [
  [1, 1], // Flurry
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6, 1], // Iter
  [7, 7, 2],
  [8, 8, 3],
  [9, 9, 4],
  [10, 10, 5],
  [11, 11, 11, 6, 1], // Flurry + Iter
  [12, 12, 12, 7, 2],
  [13, 13, 13, 8, 3],
  [14, 14, 14, 9, 4],
  [15, 15, 15, 10, 5],
  [16, 16, 16, 11, 6, 1], // Iter
  [17, 17, 17, 12, 7, 2],
  [18, 18, 18, 13, 8, 3],
  [19, 19, 19, 14, 9, 4],
  [20, 20, 20, 15, 10, 5],
];

const prettyArray = (arr) => "[" + arr.join(", ") + "]";

export const registerAttackIterativesTests = () => {
  quench.registerBatch(
    "pf1.attacks.iteratives",
    async (context) => {
      const { describe, it, expect, before, after } = context;

      let unarmed;
      let actor;
      let cls;

      before(async () => {
        // Monk
        const baseCls = await fromUuid("Compendium.pf1.classes.Item.W8dxwZ1CZiwLKsqr");
        // Unarmed Strike
        const baseAtk = await fromUuid("Compendium.pf1.monster-abilities.Item.1sU57tRb1My6XZMC");

        actor = new Actor.implementation({
          name: "test monk",
          type: "character",
          items: [baseCls.toObject(), baseAtk.toObject()],
        });

        // Basic prep for unarmed
        unarmed = actor.itemTypes.attack[0];
        unarmed.updateSource({ system: { class: "monk" } }); // Class association

        // Class
        cls = actor.itemTypes.class[0];

        actor.reset();
      });

      describe("flurry (chained)", function () {
        before(() => {
          cls.updateSource({ system: { level: 1, bab: "med" } });

          const data = unarmed.toObject();
          const act = data.system.actions[0];
          act.bab = "@class.level";
          act.extraAttacks ??= {};
          act.extraAttacks.type = "flurry";
          unarmed.updateSource({ system: { actions: data.system.actions } });

          actor.reset();
        });

        for (let i = 0; i < 20; i++) {
          const level = i + 1;
          const expectedProg = flurryProg[i];
          it(`Level ${level} – ${prettyArray(expectedProg)}`, () => {
            cls.updateSource({ system: { level } });
            actor.reset();

            const attacks = unarmed.defaultAction
              .getAttacks({ full: true, resolve: true, bonuses: true })
              .map((i) => i.bonus);

            expect(attacks).to.deep.equal(expectedProg);
          });
        }
      });

      describe("flurry (unchained)", function () {
        before(() => {
          cls.updateSource({ system: { level: 1, bab: "high" } });

          const data = unarmed.toObject();
          const act = data.system.actions[0];
          delete act.bab;
          act.extraAttacks ??= {};
          act.extraAttacks.type = "unflurry";
          unarmed.updateSource({ system: { actions: data.system.actions } });

          actor.reset();
        });

        //
        for (let i = 0; i < 20; i++) {
          const level = i + 1;
          const expectedProg = unflurryProg[i];
          it(`Level ${level} – ${prettyArray(expectedProg)}`, () => {
            cls.updateSource({ system: { level } });
            actor.reset();

            const attacks = unarmed.defaultAction
              .getAttacks({ full: true, resolve: true, bonuses: true })
              .map((i) => i.bonus);

            expect(attacks).to.deep.equal(expectedProg);
          });
        }
      });
    },
    { displayName: "PF1: Item – Attack Iteratives" }
  );
};
