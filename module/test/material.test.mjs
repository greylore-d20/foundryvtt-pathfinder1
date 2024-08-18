const getWeapon = (name) => fromUuid(game.packs.get("pf1.weapons-and-ammo").index.getName(name).uuid);
const getArmor = (name) => fromUuid(game.packs.get("pf1.armors-and-shields").index.getName(name).uuid);

export function registerMaterialTests() {
  quench.registerBatch(
    "pf1.materials",
    (context) => {
      const { describe, it, expect, before, after, assert } = context;

      const materials = /** @type {const} */ ({
        mithral: pf1.registry.materialTypes.get("mithral"),
        silver: pf1.registry.materialTypes.get("alchemicalSilver"),
        cryptstone: pf1.registry.materialTypes.get("cryptstone"),
        darkwood: pf1.registry.materialTypes.get("darkwood"),
        darkleaf: pf1.registry.materialTypes.get("darkleafCloth"),
        coldIron: pf1.registry.materialTypes.get("coldIron"),
        dragonhide: pf1.registry.materialTypes.get("dragonhide"),
        sunsilk: pf1.registry.materialTypes.get("sunsilk"),
        blightQuartz: pf1.registry.materialTypes.get("blightQuartz"),
      });

      describe("Weapons", function () {
        // Steel weapon
        describe("Longsword", function () {
          let item;
          before(async () => {
            item = await getWeapon("Longsword");
          });

          it("Valid base item", () => {
            expect(item).to.be.instanceOf(Item);
            expect(item.type).to.equal("weapon");
          });

          it("material is Steel", () => {
            expect(item.baseMaterial).to.equal("steel");
          });

          describe("Compatible", () => {
            it("can be made of Mithral", () => {
              expect(materials.mithral.isAllowed(item)).to.be.true;
            });

            it("can be Silvered", () => {
              expect(materials.silver.isAllowed(item)).to.be.true;
            });
          });

          describe("Incompatible", () => {
            it("can't be made of Darkwood", () => {
              expect(materials.darkwood.isAllowed(item)).to.be.false;
            });

            it("can't be made of Cryptstone", () => {
              expect(materials.cryptstone.isAllowed(item)).to.be.false;
            });

            it("can't be made of Darkleaf Cloth", () => {
              expect(materials.darkleaf.isAllowed(item)).to.be.false;
            });
          });
        });

        // Wooden weapon
        describe("Club", function () {
          let item;
          before(async () => {
            item = await getWeapon("Club");
          });

          it("Valid base item", () => {
            expect(item).to.be.instanceOf(Item);
            expect(item.type).to.equal("weapon");
          });

          it("material is Wood", () => {
            expect(item.baseMaterial).to.equal("wood");
          });

          describe("Compatible", () => {
            it("can be made of Darkwood", () => {
              expect(materials.darkwood.isAllowed(item)).to.be.false;
            });
          });

          describe("Incompatible", () => {
            it("can't be made of Cold Iron", () => {
              expect(materials.coldIron.isAllowed(item)).to.be.false;
            });

            it("can't be Silvered", () => {
              expect(materials.silver.isAllowed(item)).to.be.false;
            });

            it("can't be made of Cryptstone", () => {
              expect(materials.cryptstone.isAllowed(item)).to.be.false;
            });

            it("can't be made of Darkleaf Cloth", () => {
              expect(materials.darkleaf.isAllowed(item)).to.be.false;
            });
          });
        });
      });

      describe("Armor", function () {
        // Cloth armor
        describe("Padded Armor", function () {
          let item;
          before(async () => {
            item = await getArmor("Padded Armor");
          });

          it("Valid base item", () => {
            expect(item).to.be.instanceOf(Item);
            expect(item.type).to.equal("equipment");
            expect(item.subType).to.equal("armor");
          });

          it("material is Cloth", () => {
            expect(item.baseMaterial).to.equal("cloth");
          });

          describe("Compatible", () => {
            it("can have Sunsilk padding", () => {
              expect(materials.sunsilk.isAllowed(item)).to.be.true;
            });

            it("can be made of Darkleaf Cloth", () => {
              expect(materials.darkleaf.isAllowed(item)).to.be.true;
            });
          });

          describe("Incompatible", () => {
            it("can't be made of Darkwood", () => {
              expect(materials.darkwood.isAllowed(item)).to.be.false;
            });

            it("can't be made of Mithral", () => {
              expect(materials.mithral.isAllowed(item)).to.be.false;
            });

            it("can't be made of Dragonhide", () => {
              expect(materials.dragonhide.isAllowed(item)).to.be.false;
            });
          });
        });

        // Wooden armor
        describe("Wooden Armor", function () {
          let item;
          before(async () => {
            item = await getArmor("Wooden Armor");
          });

          it("Valid base item", () => {
            expect(item).to.be.instanceOf(Item);
            expect(item.type).to.equal("equipment");
            expect(item.subType).to.equal("armor");
          });

          it("material is Wood", () => {
            expect(item.baseMaterial).to.equal("wood");
          });

          describe("Compatible", () => {
            it("can be made of Darkwood", () => {
              expect(materials.darkwood.isAllowed(item)).to.be.true;
            });

            it("can have Sunsilk padding", () => {
              expect(materials.sunsilk.isAllowed(item)).to.be.true;
            });
          });

          describe("Incompatible", () => {
            it("can't be made of Mithral", () => {
              expect(materials.mithral.isAllowed(item)).to.be.false;
            });

            it("can't be made of Darkleaf Cloth", () => {
              expect(materials.darkleaf.isAllowed(item)).to.be.false;
            });

            it("can't be made of Dragonhide", () => {
              expect(materials.dragonhide.isAllowed(item)).to.be.false;
            });
          });
        });

        // Leather armor
        describe("Leather Armor", function () {
          let item;
          before(async () => {
            item = await getArmor("Leather Armor");
          });

          it("Valid base item", () => {
            expect(item).to.be.instanceOf(Item);
            expect(item.type).to.equal("equipment");
            expect(item.subType).to.equal("armor");
          });

          it("material is Leather", () => {
            expect(item.baseMaterial).to.equal("leather");
          });

          describe("Compatible", () => {
            it("can have Sunsilk padding", () => {
              expect(materials.sunsilk.isAllowed(item)).to.be.true;
            });

            it("can be made of Darkleaf Cloth", () => {
              expect(materials.darkleaf.isAllowed(item)).to.be.true;
            });

            it("can be made of Dragonhide", () => {
              expect(materials.dragonhide.isAllowed(item)).to.be.true;
            });
          });

          describe("Incompatible", () => {
            it("can't be made of Darkwood", () => {
              expect(materials.darkwood.isAllowed(item)).to.be.false;
            });

            it("can't be made of Mithral", () => {
              expect(materials.mithral.isAllowed(item)).to.be.false;
            });
          });
        });

        // Steel armor
        describe("Full Plate", function () {
          let item;
          before(async () => {
            item = await getArmor("Full Plate");
          });

          it("Valid base item", () => {
            expect(item).to.be.instanceOf(Item);
            expect(item.type).to.equal("equipment");
            expect(item.subType).to.equal("armor");
          });

          it("material is Steel", () => {
            expect(item.baseMaterial).to.equal("steel");
          });

          describe("Compatible", () => {
            it("can be made of Mithral", () => {
              expect(materials.mithral.isAllowed(item)).to.be.true;
            });
            it("can have Sunsilk padding", () => {
              expect(materials.sunsilk.isAllowed(item)).to.be.true;
            });
          });

          describe("Incompatible", () => {
            it("can't be made of Darkwood", () => {
              expect(materials.darkwood.isAllowed(item)).to.be.false;
            });

            it("can't be made of Dragonhide", () => {
              expect(materials.dragonhide.isAllowed(item)).to.be.false;
            });
          });
        });

        // Stone armor
        describe("Stoneplate", function () {
          let item;
          before(async () => {
            item = await getArmor("Stoneplate");
          });

          it("Valid base item", () => {
            expect(item).to.be.instanceOf(Item);
            expect(item.type).to.equal("equipment");
            expect(item.subType).to.equal("armor");
          });

          it("material is Stone", () => {
            expect(item.baseMaterial).to.equal("stone");
          });

          describe("Compatible", () => {
            it("can have Sunsilk padding", () => {
              expect(materials.sunsilk.isAllowed(item)).to.be.true;
            });
          });

          describe("Incompatible", () => {
            it("can't be made of Darkwood", () => {
              expect(materials.darkwood.isAllowed(item)).to.be.false;
            });

            it("can't be made of Mithral", () => {
              expect(materials.mithral.isAllowed(item)).to.be.false;
            });

            it("can't be made of Dragonhide", () => {
              expect(materials.dragonhide.isAllowed(item)).to.be.false;
            });
          });
        });
      });

      describe("Shield", function () {
        describe("Light Wooden Shield", function () {
          let item;
          before(async () => {
            item = await getArmor("Light Wooden Shield");
          });

          it("Valid base item", () => {
            expect(item).to.be.instanceOf(Item);
            expect(item.type).to.equal("equipment");
            expect(item.subType).to.equal("shield");
          });

          it("material is Wood", () => {
            expect(item.baseMaterial).to.equal("wood");
          });

          describe("Compatible", () => {
            it("can be made of Darkwood", () => {
              expect(materials.darkwood.isAllowed(item)).to.be.true;
            });
          });

          describe("Incompatible", () => {
            it("can't be made of Mithral", () => {
              expect(materials.mithral.isAllowed(item)).to.be.false;
            });

            it("can't be made of Dragonhide", () => {
              expect(materials.dragonhide.isAllowed(item)).to.be.false;
            });
          });
        });

        describe("Buckler", function () {
          let item;
          before(async () => {
            item = await getArmor("Buckler");
          });

          it("Valid base item", () => {
            expect(item).to.be.instanceOf(Item);
            expect(item.type).to.equal("equipment");
            expect(item.subType).to.equal("shield");
          });

          it("material is Steel", () => {
            expect(item.baseMaterial).to.equal("steel");
          });

          describe("Compatible", () => {
            it("can be made of Mithral", () => {
              expect(materials.mithral.isAllowed(item)).to.be.false;
            });
          });

          describe("Incompatible", () => {
            it("can't be made of Darkwood", () => {
              expect(materials.darkwood.isAllowed(item)).to.be.false;
            });

            it("can't be made of Dragonhide", () => {
              expect(materials.dragonhide.isAllowed(item)).to.be.false;
            });
          });
        });
      });
    },
    {
      displayName: "PF1: Materials",
    }
  );
}
