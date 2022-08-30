/**
 * This namespace contains hook events fired by the system.
 * All hooks introduced by the system are prefixed with `pf1` to namespace them.
 * Each hook contains a remark denoting whether it is called with [`Hooks.callAll`](https://foundryvtt.com/api/v10/classes/client.Hooks.html#callAll)
 * or [`Hooks.call`](https://foundryvtt.com/api/v10/classes/client.Hooks.html#callAll).
 * Only hooks that are called with `Hooks.call` can be stopped by returning `false` from the callback.
 *
 * @module hookEvents
 * @example Registering callback
 * ```javascript
 * Hooks.on("pf1PostReady", () => {
 *   console.log("The system is now ready.");
 * });
 * ```
 * @example Stopping a process by returning `false`
 * ```javascript
 * Hooks.on("pf1PostItemAttack", () => {
 *  return false; // No chat message will be posted
 * });
 * ```
 */
import { ActorPF } from "@actor/actor-pf.mjs";
import { ItemPF } from "@item/item-pf.mjs";
import { ItemBuffPF } from "@item/item-buff.mjs";
import { PF1 } from "@config";
import { ItemContainerPF } from "@item/item-container.mjs";
import { ItemSheetPF_Container } from "./module/applications/item/container-sheet.mjs";
import { ItemAction } from "@component/action.mjs";
import { ItemChange } from "@component/change.mjs";
import { ItemClassPF } from "@item/item-class.mjs";

import * as actorPF from "@actor/actor-pf.mjs";
import * as itemPF from "@item/item-pf.mjs";

declare global {
  namespace Hooks {
    interface StaticCallbacks {
      // ------------------------- //
      //      Initialization       //
      // ------------------------- //
      /**
       * A hook event fired by the system when it has finished its own `init` phase.
       *
       * @group Initialization
       * @remarks Called by {@link Hooks.callAll}
       */
      pf1PostInit: () => void;

      /**
       * A hook event fired by the system when it has finished its own `setup` phase.
       *
       * @group Initialization
       * @remarks Called by {@link Hooks.callAll}
       */
      pf1PostSetup: () => void;

      /**
       * A hook event fired by the system when it has finished its own `ready` phase.
       * As the system's `ready` hook is asynchronous, this is the only hook that guarantees that the system is ready.
       * The default `ready` hook includes no such guarantee.
       *
       * @group Initialization
       * @remarks Called by {@link Hooks.callAll}
       */
      pf1PostReady: () => void;

      // ------------------------- //
      //           Actor           //
      // ------------------------- //
      /**
       * A hook event fired by the system when one or more of an actor's conditions have changed.
       * The `conditions` object can be found in `actor.system.attributes.conditions`.
       *
       * @group Actor
       * @remarks Called by {@link Hooks.callAll}
       * @see {@link pf1!config conditionTypes in pf1.config}
       * @param actor - The actor whose conditions have changed.
       * @param condition - The name of the condition that has changed as per `CONFIG.PF1.conditionTypes`.
       * @param state - The new state of the condition.
       */
      pf1ToggleActorCondition: (
        actor: ActorPF,
        condition: keyof typeof PF1.conditionTypes | (string & {}),
        state: boolean
      ) => void;

      /**
       * A hook event fired by the system when the `system.active` property of an {@link ItemBuffPF} embedded
       * in an {@link ActorPF} has changed.
       * This is also fired when a buff with its `active` state already set to `true` is added to an actor.
       *
       * @group Actor
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor whose buff's active state has changed.
       * @param item - The buff whose active state has changed.
       * @param state - The new state of the buff.
       */
      pf1ToggleActorBuff: (actor: ActorPF, item: ItemBuffPF, state: boolean) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} gains XP.
       *
       * @group Actor
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who gained XP.
       * @param xp - An object containing a number that can be adjusted in callbacks.
       * @param xp.value - The amount of XP gained.
       */
      pf1GainXp: (actor: ActorPF, xp: { value: number }) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF}'s base data is prepared.
       * This happens whenever an actor is updated, and the preparation process is expected to be synchronous.
       * Data added or mutated asynchronously might not be factored in at all.
       *
       * @group Actor
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor whose data is prepared.
       */
      pf1PrepareBaseActorData: (actor: ActorPF) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF}'s derived data is prepared.
       * This happens whenever an actor is updated, and the preparation process is expected to be synchronous.
       * Data added or mutated asynchronously might not be factored in at all.
       *
       * @group Actor
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor whose data is prepared.
       */
      pf1PrepareDerivedActorData: (actor: ActorPF) => void;

      /**
       * A hook event fired by the system when an actor's {@link ActorPF.performRest} is called.
       *
       * @group Actor
       * @remarks Called by {@link Hooks.call}
       * @see {@link pf1!documents.actor.ActorPF.performRest ActorPF#performRest}
       * @param actor - The actor who is resting.
       * @param restOptions - The options passed to the method's call.
       *   Mutating this data will not affect the system's calculations, as they are finished when this hook is fired.
       *   This data can be used to base different rest calculations on, however.
       * @param updateData - The data the resting actor will be updated with.
       *   This data object can be mutated to affect the update (e.g. the number of hit points).
       * @param itemUpdates - An array of item updates to be applied to the resting actor.
       *   This array can be mutated to affect the update (e.g. which item's uses are restored).
       * @returns Explicitly return `false` to prevent the actor from resting.
       */
      pf1PreActorRest: (
        actor: ActorPF,
        restOptions: actorPF.ActorRestOptions,
        updateData: Record<string, unknown>,
        itemUpdates: Record<string, unknown>[]
      ) => boolean;

      /**
       * A hook event fired by the system after an actor has rested.
       *
       * @group Actor
       * @remarks Called by {@link Hooks.callAll}
       * @see {@link pf1!documents.actor.ActorPF.performRest ActorPF#performRest}
       * @param actor - The actor who has rested.
       * @param restOptions - The options passed to the method's call.
       *   Mutating this data will not affect the system's calculations, as they are finished when this hook is fired.
       *   This data can be used to base different rest calculations on, however.
       * @param updateData - The data the resting actor was updated with.
       * @param itemUpdates - An array of item updates applied to the resting actor.
       */
      pf1ActorRest: (
        actor: ActorPF,
        restOptions: ActorRestOptions,
        updateData: Record<string, unknown>,
        itemUpdates: Record<string, unknown>[]
      ) => void;

      // ------------------------- //
      //        Actor Rolls        //
      // ------------------------  //
      /**
       * A hook event fired by the system when an {@link ActorPF} rolls a skill.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling a skill
       * @param skill - The ID of the skill being rolled
       * @param options - Additional options for the roll
       * @returns Explicitly return `false` to prevent the actor from rolling the skill.
       */
      pf1PreActorRollSkill: (actor: ActorPF, skill: string, options: RollOptionsPF) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled a skill.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled a skill
       * @param skill - The ID of the skill that was rolled
       * @param roll - The roll result
       */
      pf1ActorRollSkill: (actor: ActorPF, roll: ChatMessage | Roll, skill: string) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls their BAB.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling their BAB
       * @param options - Additional options for the roll
       * @returns Explicitly return `false` to prevent the actor from rolling their BAB.
       */
      pf1PreActorRollBab: (actor: ActorPF, options: RollOptionsPF) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled their BAB.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled their BAB
       * @param roll - The roll result
       */
      pf1ActorRollBab: (actor: ActorPF, roll: ChatMessage | Roll) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls their CMB.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling their CMB
       * @param options - Additional options for the roll
       * @returns Explicitly return `false` to prevent the actor from rolling their CMB.
       */
      pf1PreActorRollCmb: (actor: ActorPF, options: RollOptionsPF) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled their CMB.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled their CMB
       * @param roll - The roll result
       */
      pf1ActorRollCmb: (actor: ActorPF, roll: ChatMessage | Roll) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls a caster level check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling a caster level check
       * @param spellbook - The key of the spellbook whose caster level is rolled
       * @param options - Additional options for the roll
       * @returns Explicitly return `false` to prevent the actor from rolling the caster level check.
       */
      pf1PreActorRollCl: (actor: ActorPF, spellbook: string, options: RollOptionsPF) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled a caster level check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled a caster level check
       * @param roll - The roll result
       * @param spellbook - The key of the spellbook whose caster level was rolled
       */
      pf1ActorRollCl: (actor: ActorPF, roll: ChatMessage | Roll, spellbook: string) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls a concentration check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling a concentration check
       * @param spellbook - The key of the spellbook whose concentration is rolled
       * @param options - Additional options for the roll
       * @returns Explicitly return `false` to prevent the actor from rolling the concentration check.
       */
      pf1PreActorRollConcentration: (actor: ActorPF, spellbook: string, options: RollOptionsPF) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled a concentration check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled a concentration check
       * @param roll - The roll result
       * @param spellbook - The key of the spellbook whose concentration was rolled
       */
      pf1ActorRollConcentration: (actor: ActorPF, roll: ChatMessage | Roll, spellbook: string) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls a save.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling a save
       * @param save - The key of the save being rolled
       * @param options - Additional options for the roll
       * @returns Explicitly return `false` to prevent the actor from rolling the save.
       */
      pf1PreActorRollSave: (actor: ActorPF, save: "fort" | "ref" | "will", options: RollOptionsPF) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled a save.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled a save
       * @param roll - The roll result
       * @param save - The key of the save that was rolled
       */
      pf1ActorRollSave: (actor: ActorPF, roll: ChatMessage | Roll, save: "fort" | "ref" | "will") => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls an ability check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling an ability check
       * @param ability - The key of the ability being rolled
       * @param options - Additional options for the roll
       * @returns Explicitly return `false` to prevent the actor from rolling the ability check.
       */
      pf1PreActorRollAbility: (actor: ActorPF, ability: string, options: RollOptionsPF) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled an ability check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled an ability check
       * @param roll - The roll result
       * @param ability - The key of the ability that was rolled
       */
      pf1ActorRollAbility: (actor: ActorPF, roll: ChatMessage | Roll, ability: string) => void;

      // ------------------------- //
      //            Item           //
      // ------------------------  //
      /**
       * A hook event fired by the system when the level of a class item is changed.
       *
       * @group Item
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor whose class item's level is being changed.
       * @param classItem - The class item whose level is being changed.
       * @param currentLevel - The current level of the class item.
       * @param newLevel - The new level of the class item.
       */
      pf1ClassLevelChange: (actor: ActorPF, classItem: ItemClassPF, currentLevel: number, newLevel: number) => void;

      /**
       * A hook event fired by the system when an item's chat card is to be displayed.
       *
       * @group Item
       * @remarks Called by {@link Hooks.call}
       * @see {@link pf1!documents.item.ItemPF.displayCard ItemPF#displayCard}
       * @param item - The item whose chat card is being displayed.
       * @param data - Data related to the item's use.
       * @returns Explicitly return `false` to prevent the item's chat card from being displayed.
       */
      pf1DisplayCard: (
        item: ItemPF,
        data: {
          /** The path of the template used to render the chat card */
          template: string;
          /**
           * The data to be passed to the {@link foundry.utils.renderTemplate} call.
           * The contents of this object can change unexpectedly, as each change to the system's chat card template
           * or item data will affect it.
           */
          templateData: Record<string, unknown>;
          /** The data passed to {@link ChatMessage.create} (excluding `content` from the rendered template) */
          chatData: Record<string, unknown>;
        }
      ) => boolean;

      // ------------------------- //
      //          Actions          //
      // ------------------------- //
      /**
       * A hook event fired by the system when an action is to be used.
       * This hook fires before any updates are applied to the actor/item, like ammo or spell slots.
       *
       * @group Actions
       * @remarks Called by {@link Hooks.call}
       * @param action - The action that is to be used.
       * @param data - Data related to the action's use.
       * @returns Explicitly return `false` to prevent the action from being used.
       */
      pf1PreActionUse: (action: ItemAction, shared: itemPF.SharedActionData) => boolean;

      /**
       * A hook event fired by the system when an action is used, before the chat message is created.
       *
       * @group Actions
       * @remarks Called by {@link Hooks.call}
       * @param action - The action that is to be used.
       * @param data - Data related to the action's use.
       * @returns Explicitly return `false` to prevent the action's usage chat card being displayed.
       */
      pf1PreDisplayActionUse: (action: ItemAction, data: itemPF.SharedActionData) => boolean;

      // ------------------------- //
      //          Changes          //
      // ------------------------- //
      /**
       * A hook event fired by the system when the system determines which data fields a change target should affect,
       * i.e. flattens the change target to target data fields.
       * This is called for every {@link pf1!components.ItemChange ItemChange} on every actor for every data preparation,
       * so callbacks should be efficient.
       *
       * @group Changes
       * @remarks Called by {@link Hooks.callAll}
       * @example Adding a (weird) Change that increases an actor's gold
       * ```js
       * // Add a change target
       * Hooks.once("init", () => {
       *   CONFIG.PF1.buffTargets.gp = {
       *     label: "Gold Pieces",
       *     category: "misc",
       *   };
       * });
       * // Define the correct data field for the change to target
       * Hooks.on("pf1GetChangeFlat", (target, modifier, result) => {
       *   if (target === "gp") {
       *     result.push("system.currency.gp");
       *   }
       * });
       * ```
       * @param changeTarget - The change target as per the change's `subTarget` property,
       *   see {@link pf1!components.ItemChange.subTarget ItemChange#subTarget} and {@link pf1!config pf1.config.buffTargets}.
       * @param changeType - The change type as per the change's `modifier` property,
       *   see {@link pf1!components.ItemChange.modifier ItemChange#modifier} and {@link pf1!config pf1.config.bonusModifiers}.
       * @param result - An array of target data fields.
       * @param curData - The current data of the actor the change is being applied to.
       */
      pf1GetChangeFlat: (
        changeTarget: string,
        changeType: string,
        result: string[],
        curData: Record<string, unknown>
      ) => void;

      /**
       * A hook event fired by the system when an actor's data is prepared and the system adds inherent/default Changes.
       *
       * @group Changes
       * @remarks Called by {@link Hooks.callAll}
       * @example Adding a default Change that increases every actor's strength
       * ```js
       * Hooks.on("pf1AddDefaultChanges", (actor, changes) => {
       *   changes.push(
       *     new pf1.components.ItemChange({
       *       subTarget: "str",
       *       formula: "2",
       *     })
       *   );
       * });
       * ```
       * @param actor - The actor whose data is being prepared.
       * @param changes - An array of default changes to be applied to the actor.
       */
      pf1AddDefaultChanges: (actor: ActorPF, changes: ItemChange[]) => void;

      // ------------------------- //
      //         Migration         //
      // ------------------------- //
      /**
       * A hook event fired by the system when it has finished its {@link pf1!migration migration}.
       *
       * @group Migration
       * @remarks Called by {@link Hooks.callAll}
       */
      pf1MigrationFinished: () => void;

      // ------------------------- //
      //        Sheet Events       //
      // ------------------------- //
      /**
       * A hook event fired by the system when data is dropped onto an  {@link ItemSheetPF_Container}.
       *
       * @group Sheet Events
       * @remarks Called by {@link Hooks.call}
       * @param item - The container item the sheet belongs to.
       * @param sheet - The container item's sheet.
       * @param data - The data that was dropped.
       * @returns Explicitly return `false` to prevent the drop event from being handled.
       */
      pf1DropContainerSheetData: (
        item: ItemContainerPF,
        sheet: ItemSheetPF_Container,
        data: Record<string, unknown>
      ) => boolean;

      // ------------------------- //
      //            Dice           //
      // ------------------------- //
      // TODO: Fix types for actual function, then adjust in hook
      /**
       * A hook event fired by the system when a generic dice roll is made.
       *
       * @see {@link pf1!dice.DicePF.d20Roll DicePF.d20Roll}
       * @group Dice
       * @remarks Called by {@link Hooks.call}
       * @param data - Data used for the roll.
       * @returns Explicitly return `false` to prevent the roll from being made.
       */
      pf1PreRoll: (data: Record<string, unknown>) => boolean;

      // ------------------------- //
      //         Item Links        //
      // ------------------------- //
      /**
       * A hook event fired by the system after an item link is created.
       *
       * @group Item Links
       * @remarks Called by {@link Hooks.callAll}
       * @param item - The item on which the link is being created.
       * @param link - The link being created.
       * @param kind - The kind of link being created.
       */
      pf1CreateItemLink: (
        item: ItemPF,
        link: ItemLink,
        kind: "children" | "charges" | "classAssociations" | "ammunition"
      ) => void;
      /**
       * A hook event fired by the system after an item link is deleted.
       *
       * @group Item Links
       * @remarks Called by {@link Hooks.callAll}
       * @param item - The item whose links data was changed.
       * @param link - Link data that was deleted.
       * @param kind - The type of the link that was deleted.
       */
      pf1DeleteItemLink: (
        item: ItemPF,
        link: ItemLink,
        kind: "children" | "charges" | "classAssociations" | "ammunition"
      ) => void;

      // ------------------------- //
      //          Roll Data        //
      // ------------------------- //

      /**
       * A hook event fired by the system when roll data is created.
       * The hook is fired at the end of the system's roll data creation process.
       *
       * @group Roll Data
       * @remarks Called by {@link Hooks.callAll}
       * @see {@link pf1!documents.actor.ActorPF.getRollData ActorPF#getRollData}
       * @see {@link pf1!documents.item.ItemPF.getRollData ItemPF#getRollData}
       * @see {@link pf1!components.ItemAction.getRollData ItemAction#getRollData}
       * @param document - The document or component whose roll data is to be created.
       * @param data - The created roll data that can be modified.
       */
      pf1GetRollData: (document: ActorPF | ItemPF | ItemAction, data: Record<string, unknown>) => void;
    }
  }
}

interface ItemLink {
  /** The unique ID of this link */
  id: string;
  dataType: string;
  /** The displayed name of this link */
  name: string;
  /** The path to the image of this link */
  img: string;
  /** The index at which this link is displayed */
  _index: number;
  /** The level at which the feature linked by this class association is gained. */
  level?: number;
}

// TODO: These should be defined in their relevant files, not in here
interface RollOptionsPF {
  event: Event;
  skipDialog?: boolean;
  staticRoll?: number;
  chatMessage?: boolean;
  noSound?: boolean;
  dice?: string;
  bonus?: string;
}

// Initialization
export declare const pf1PostInit: Hooks.StaticCallbacks["pf1PostInit"];
export declare const pf1PostSetup: Hooks.StaticCallbacks["pf1PostSetup"];
export declare const pf1PostReady: Hooks.StaticCallbacks["pf1PostReady"];

// Actor
export declare const pf1ToggleActorCondition: Hooks.StaticCallbacks["pf1ToggleActorCondition"];
export declare const pf1ToggleActorBuff: Hooks.StaticCallbacks["pf1ToggleActorBuff"];
export declare const pf1GainXp: Hooks.StaticCallbacks["pf1GainXp"];
export declare const pf1PrepareBaseActorData: Hooks.StaticCallbacks["pf1PrepareBaseActorData"];
export declare const pf1PrepareDerivedActorData: Hooks.StaticCallbacks["pf1PrepareDerivedActorData"];
export declare const pf1PreActorRest: Hooks.StaticCallbacks["pf1PreActorRest"];
export declare const pf1ActorRest: Hooks.StaticCallbacks["pf1ActorRest"];

// Actor Rolls
export declare const pf1PreActorRollSkill: Hooks.StaticCallbacks["pf1PreActorRollSkill"];
export declare const pf1PreActorRollBab: Hooks.StaticCallbacks["pf1PreActorRollBab"];
export declare const pf1PreActorRollCmb: Hooks.StaticCallbacks["pf1PreActorRollCmb"];
export declare const pf1PreActorRollCl: Hooks.StaticCallbacks["pf1PreActorRollCl"];
export declare const pf1PreActorRollConcentration: Hooks.StaticCallbacks["pf1PreActorRollConcentration"];
export declare const pf1PreActorRollSave: Hooks.StaticCallbacks["pf1PreActorRollSave"];
export declare const pf1PreActorRollAbility: Hooks.StaticCallbacks["pf1PreActorRollAbility"];

export declare const pf1ActorRollSkill: Hooks.StaticCallbacks["pf1ActorRollSkill"];
export declare const pf1ActorRollBab: Hooks.StaticCallbacks["pf1ActorRollBab"];
export declare const pf1ActorRollCmb: Hooks.StaticCallbacks["pf1ActorRollCmb"];
export declare const pf1ActorRollCl: Hooks.StaticCallbacks["pf1ActorRollCl"];
export declare const pf1ActorRollConcentration: Hooks.StaticCallbacks["pf1ActorRollConcentration"];
export declare const pf1ActorRollSave: Hooks.StaticCallbacks["pf1ActorRollSave"];
export declare const pf1ActorRollAbility: Hooks.StaticCallbacks["pf1ActorRollAbility"];

// Item
export declare const pf1ClassLevelChange: Hooks.StaticCallbacks["pf1ClassLevelChange"];
export declare const pf1DisplayCard: Hooks.StaticCallbacks["pf1DisplayCard"];

// Action
export declare const pf1PreActionUse: Hooks.StaticCallbacks["pf1PreActionUse"];
export declare const pf1PreDisplayActionUse: Hooks.StaticCallbacks["pf1PreDisplayActionUse"];

// Changes
export declare const pf1GetChangeFlat: Hooks.StaticCallbacks["pf1GetChangeFlat"];
export declare const pf1AddDefaultChanges: Hooks.StaticCallbacks["pf1AddDefaultChanges"];

// Migration
export declare const pf1MigrationFinished: Hooks.StaticCallbacks["pf1MigrationFinished"];

// Sheet Events
export declare const pf1DropContainerSheetData: Hooks.StaticCallbacks["pf1DropContainerSheetData"];

// Dice
export declare const pf1PreRoll: Hooks.StaticCallbacks["pf1PreRoll"];

// Item Links
export declare const pf1CreateItemLink: Hooks.StaticCallbacks["pf1CreateItemLink"];
export declare const pf1DeleteItemLink: Hooks.StaticCallbacks["pf1DeleteItemLink"];

// Roll Data
export declare const pf1GetRollData: Hooks.StaticCallbacks["pf1GetRollData"];
