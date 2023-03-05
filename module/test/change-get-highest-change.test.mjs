import { ItemChange } from "@component/change.mjs";

export const registerGetHighestChangeTests = () => {
  quench.registerBatch(
    "pf1.change.getHighestChanges",
    async (context) => {
      const { describe, it, expect } = context;

      describe("getHighestChanges with stacking changes", () => {
        it("should return all changes", () => {
          const changes = [
            { formula: "1", modifier: "untyped" },
            { formula: "2", modifier: "untyped" },
            { formula: "3", modifier: "untyped" },
          ].map((data) => new ItemChange(data));
          changes.forEach((change) => change.evaluate());
          const highestChanges = ItemChange.getHighestChanges(changes);
          expect(highestChanges).to.have.lengthOf(3);
          expect(highestChanges).to.include.all.members(changes);
        });
      });

      describe("getHighestChanges with non-stacking changes", () => {
        it("should return only the highest change", () => {
          const changes = [
            { formula: "1", modifier: "enh" },
            { formula: "2", modifier: "enh" },
            { formula: "3", modifier: "enh" },
          ].map((data) => new ItemChange(data));
          changes.forEach((change) => change.evaluate());
          const highestChanges = ItemChange.getHighestChanges(changes);
          expect(highestChanges).to.have.lengthOf(1);
          expect(highestChanges).to.deep.equal([changes[2]]);
        });
      });

      describe("getHighestChanges with mixed changes", () => {
        it("should return only the highest changes", () => {
          const changes = [
            { formula: "1", modifier: "enh" },
            { formula: "2", modifier: "enh" },
            { formula: "3", modifier: "untyped" },
          ].map((data) => new ItemChange(data));
          changes.forEach((change) => change.evaluate());
          const highestChanges = ItemChange.getHighestChanges(changes);
          expect(highestChanges).to.have.lengthOf(2);
          expect(highestChanges).to.contain(changes[2]).and.to.contain(changes[1]).and.to.not.contain(changes[0]);
        });
      });

      describe("getHighestChanges with mixed changes", () => {
        it("should return only the highest changes", () => {
          const changes = [
            { formula: "1", modifier: "enh" },
            { formula: "2", modifier: "enh" },
            { formula: "3", modifier: "untyped" },
            { formula: "4", modifier: "untyped" },
            { formula: "5", modifier: "untypedPerm" },
          ].map((data) => new ItemChange(data));
          changes.forEach((change) => change.evaluate());
          const highestChanges = ItemChange.getHighestChanges(changes);
          expect(highestChanges).to.have.lengthOf(4);
          expect(highestChanges)
            .to.contain(changes[4])
            .and.to.contain(changes[3])
            .and.to.contain(changes[2])
            .and.to.contain(changes[1])
            .and.to.not.contain(changes[0]);
        });
      });
    },
    {
      displayName: "PF1: ItemChange#getHighestChanges",
    }
  );
};
