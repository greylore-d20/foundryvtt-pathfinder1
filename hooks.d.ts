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
 * Hooks.on("pf1PreActorRollSkill", () => {
 *  return false; // No chat message will be posted
 * });
 * ```
 */
import { ActorPF } from "@actor/actor-pf.mjs";
import { ItemPF } from "@item/item-pf.mjs";
import { ItemBuffPF } from "@item/item-buff.mjs";
import { ItemSheetPF_Container } from "./module/applications/item/container-sheet.mjs";
import { ItemAction } from "@component/action.mjs";
import { ItemChange } from "@component/change.mjs";
import { ItemClassPF } from "@item/item-class.mjs";
import { ActionUse } from "@actionUse/action-use.mjs";

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
       * The `conditions` object can be found in `actor.system.conditions`.
       *
       * @group Actor
       * @remarks Called by {@link Hooks.callAll}
       * @see {@link pf1.registry.conditions conditions}
       * @param actor - The actor whose conditions have changed.
       * @param condition - The name of the condition that has changed as per `CONFIG.PF1.conditionTypes`.
       * @param state - The new state of the condition.
       */
      pf1ToggleActorCondition: (
        actor: ActorPF,
        condition: keyof typeof pf1.config.conditionTypes | (string & {}), // string & {} prevents the enum strings from disappearing into string
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
       * @see {@link pf1.documents.actor.ActorPF.performRest ActorPF#performRest}
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
       * @see {@link pf1.documents.actor.ActorPF.performRest ActorPF#performRest}
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
       * @param options - Additional options for the roll
       * @param skill - The ID of the skill being rolled
       * @returns Explicitly return `false` to prevent the actor from rolling the skill.
       */
      pf1PreActorRollSkill: (actor: ActorPF, options: ActorRollOptions, skill: string) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled a skill.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled a skill
       * @param result - The roll result, either as {@link ChatMessage} if one was created, or as object containing
       *  data that would have been used to create one.
       * @param skill - The ID of the skill that was rolled
       */
      pf1ActorRollSkill: (actor: ActorPF, result: ChatMessage | object, skill: string) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls their BAB.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling their BAB
       * @param options - Additional options for the roll
       * @returns Explicitly return `false` to prevent the actor from rolling their BAB.
       */
      pf1PreActorRollBab: (actor: ActorPF, options: ActorRollOptions) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled their BAB.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled their BAB
       * @param result - The roll result, either as {@link ChatMessage} if one was created, or as object containing
       *  data that would have been used to create one.
       */
      pf1ActorRollBab: (actor: ActorPF, result: ChatMessage | object) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls a caster level check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling a caster level check
       * @param options - Additional options for the roll
       * @param spellbook - The key of the spellbook whose caster level is rolled
       * @returns Explicitly return `false` to prevent the actor from rolling the caster level check.
       */
      pf1PreActorRollCl: (actor: ActorPF, options: ActorRollOptions, spellbook: string) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled a caster level check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled a caster level check
       * @param result - The roll result, either as {@link ChatMessage} if one was created, or as object containing
       *  data that would have been used to create one.
       * @param spellbook - The key of the spellbook whose caster level was rolled
       */
      pf1ActorRollCl: (actor: ActorPF, result: ChatMessage | object, spellbook: string) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls a concentration check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling a concentration check
       * @param options - Additional options for the roll
       * @param spellbook - The key of the spellbook whose concentration is rolled
       * @returns Explicitly return `false` to prevent the actor from rolling the concentration check.
       */
      pf1PreActorRollConcentration: (actor: ActorPF, options: ActorRollOptions, spellbook: string) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled a concentration check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled a concentration check
       * @param result - The roll result, either as {@link ChatMessage} if one was created, or as object containing
       *  data that would have been used to create one.
       * @param spellbook - The key of the spellbook whose concentration was rolled
       */
      pf1ActorRollConcentration: (actor: ActorPF, result: ChatMessage | object, spellbook: string) => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls a save.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling a save
       * @param options - Additional options for the roll
       * @param save - The key of the save being rolled
       * @returns Explicitly return `false` to prevent the actor from rolling the save.
       */
      pf1PreActorRollSave: (actor: ActorPF, options: ActorRollOptions, save: "fort" | "ref" | "will") => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled a save.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled a save
       * @param result - The roll result, either as {@link ChatMessage} if one was created, or as object containing
       *  data that would have been used to create one.
       * @param save - The key of the save that was rolled
       */
      pf1ActorRollSave: (actor: ActorPF, result: ChatMessage | object, save: "fort" | "ref" | "will") => void;

      /**
       * A hook event fired by the system when an {@link ActorPF} rolls an ability check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.call}
       * @param actor - The actor rolling an ability check
       * @param options - Additional options for the roll
       * @param ability - The key of the ability being rolled
       * @returns Explicitly return `false` to prevent the actor from rolling the ability check.
       */
      pf1PreActorRollAbility: (actor: ActorPF, options: ActorRollOptions, ability: string) => boolean;

      /**
       * A hook event fired by the system after an {@link ActorPF} rolled an ability check.
       *
       * @group Actor Rolls
       * @remarks Called by {@link Hooks.callAll}
       * @param actor - The actor who rolled an ability check
       * @param result - The roll result, either as {@link ChatMessage} if one was created, or as object containing
       *  data that would have been used to create one.
       * @param ability - The key of the ability that was rolled
       */
      pf1ActorRollAbility: (actor: ActorPF, result: ChatMessage | object, ability: string) => void;

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
       * @see {@link pf1.documents.item.ItemPF.displayCard ItemPF#displayCard}
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
       * This hook fires before any updates are applied to the actor/item, like ammo or spell slots, and before
       * any attacks are rolled.
       *
       * @group Actions
       * @remarks Called by {@link Hooks.callAll}
       * @param actionUse - The {@link ActionUse} instance containing all data relevant to the action use.
       */
      pf1CreateActionUse: (actionUse: ActionUse) => void;

      /**
       * A hook event fired by the system when an action is to be used.
       * This hook fires before any updates are applied to the actor/item, like ammo or spell slots and includes
       * all of the action's rolled attacks.
       *
       * @group Actions
       * @remarks Called by {@link Hooks.call}
       * @param actionUse - The {@link ActionUse} instance containing all data relevant to the action use.
       * @returns Explicitly return `false` to prevent the action from being used.
       */
      pf1PreActionUse: (actionUse: ActionUse) => boolean;

      /**
       * A hook event fired by the system when an action is used, before the chat message is created.
       *
       * @group Actions
       * @remarks Called by {@link Hooks.call}
       * @param actionUse - The {@link ActionUse} instance containing all data relevant to the action use.
       * @returns Explicitly return `false` to prevent the action's usage chat card being displayed.
       */
      pf1PreDisplayActionUse: (actionUse: ActionUse) => boolean;

      /**
       * A hook event fired by the system when an action has been successfully used.
       * This hook fires after the action has been used and after any chat .
       *
       * @group Actions
       * @remarks Called by {@link Hooks.callAll}
       * @param actionUse - The {@link ActionUse} instance containing all data relevant to the action use.
       * @param chatMessage - The {@link ChatMessage | null} created by using the action, or null if no message was created.
       */
      pf1PostActionUse: (actionUse: ActionUse, chatMessage: ChatMessage?) => void;

      /**
       * Pre-attack roll hook fired before rolling an attack.
       *
       * @param action - Action triggering the attack roll
       * @param config - Attack configuration
       * @param rollData - Roll data
       * @param rollOptions - Options to be passed to D20RollPF
       */
      pf1PreAttackRoll: (action: ItemAction, config: object, rollData: object, rollOptions: object) => void;

      /**
       * Post attack roll hook fired after evaluating attack roll.
       *
       * @param {ItemAction} action - Action that triggered the attack roll
       * @param {D20RollPF} roll - The attack roll
       * @param {object} config - Attack configuration
       */
      pf1AttackRoll: (action: ItemAction, roll: D20RollPF, context: object) => void;

      // ------------------------- //
      //          Changes          //
      // ------------------------- //
      /**
       * A hook event fired by the system when the system determines which data fields a change target should affect,
       * i.e. flattens the change target to target data fields.
       * This is called for every {@link pf1.components.ItemChange ItemChange} on every actor for every data preparation,
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
       * Hooks.on("pf1GetChangeFlat", (result, target, modifierType, value, actor) => {
       *   if (target === "gp") {
       *     result.push("system.currency.gp");
       *   }
       * });
       * ```
       * @param result - An array of target data fields.
       * @param target - The change target as per the change's `subTarget` property,
       *   see {@link pf1.components.ItemChange.target ItemChange#target} and {@link pf1.config.buffTargets change targets}.
       * @param modifierType - The change type as per the change's `modifier` property,
       *   see {@link pf1.components.ItemChange.type ItemChange#type} and {@link pf1.config.bonusTypes change types}.
       * @param value - The numerical change value, if any.
       * @param actor - The actor the change is being applied to.
       */
      pf1GetChangeFlat: (
        result: string[],
        target: BuffTarget | (string & {}),
        modifierType: ModifierType | (string & {}) | undefined,
        value: number | undefined,
        actor: ActorPF
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
       * A hook event fired by the system when it starts its {@link pf1.migrations.migrateWorld migration}.
       *
       * @group Migration
       * @remarks Called by {@link Hooks.callAll}
       */
      pf1MigrationStarted: () => void;
      /**
       * A hook event fired by the system when it has finished its {@link pf1.migrations.migrateWorld migration}.
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
       * @see {@link pf1.documents.actor.ActorPF.getRollData ActorPF#getRollData}
       * @see {@link pf1.documents.item.ItemPF.getRollData ItemPF#getRollData}
       * @see {@link pf1.components.ItemAction.getRollData ItemAction#getRollData}
       * @param document - The document or component whose roll data is to be created.
       * @param data - The created roll data that can be modified.
       */
      pf1GetRollData: (document: ActorPF | ItemPF | ItemAction, data: Record<string, unknown>) => void;

      // ------------------------- //
      //          Combat           //
      // ------------------------- //

      /**
       * Hook event fired when turns are skipped in combat.
       *
       * @group Combat
       * @remarks Called by {@link Hooks.callAll}
       * @param combat - Relevant combat instance
       * @param skipped - Set of combatants whose turn was passed over.
       * @param context - Combat update context object.
       */
      pf1CombatTurnSkip: (combat: CombatPF, skipped: Set<CombatantPF>, context: Record<string, unknown>) => void;
    }

    /**
     * A hook event fired by the system when a registry is initialized.
     * Substitute the `Registry` part of the hook name with the name of the registry,
     * for example `pf1RegisterDamageTypes`.
     *
     * @group Registry
     * @remarks Called by {@link Hooks.callAll}
     * @param registry - The registry that is initialized.
     * @see {@link pf1.registry.Registry.register Registry#register}
     * @see {@link pf1.registry.Registry.unregister Registry#unregister}
     * @example
     * ```js
     * Hooks.on("pf1RegisterDamageTypes", (registry, model) => {
     *   registry.register("my-module", "my-damage-type", {
     *     name: "My Damage Type",
     *     icon: "icons/svg/damage.svg",
     *     color: "#00ff00",
     *     category: "physical",
     *   });
     * });
     * ```
     */
    export type pf1RegisterRegistry<R extends pf1.registry.Registry = pf1.registry.Registry> = (registry: R) => void;
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
export declare const pf1PreActorRollCl: Hooks.StaticCallbacks["pf1PreActorRollCl"];
export declare const pf1PreActorRollConcentration: Hooks.StaticCallbacks["pf1PreActorRollConcentration"];
export declare const pf1PreActorRollSave: Hooks.StaticCallbacks["pf1PreActorRollSave"];
export declare const pf1PreActorRollAbility: Hooks.StaticCallbacks["pf1PreActorRollAbility"];

export declare const pf1ActorRollSkill: Hooks.StaticCallbacks["pf1ActorRollSkill"];
export declare const pf1ActorRollBab: Hooks.StaticCallbacks["pf1ActorRollBab"];
export declare const pf1ActorRollCl: Hooks.StaticCallbacks["pf1ActorRollCl"];
export declare const pf1ActorRollConcentration: Hooks.StaticCallbacks["pf1ActorRollConcentration"];
export declare const pf1ActorRollSave: Hooks.StaticCallbacks["pf1ActorRollSave"];
export declare const pf1ActorRollAbility: Hooks.StaticCallbacks["pf1ActorRollAbility"];

// Item
export declare const pf1ClassLevelChange: Hooks.StaticCallbacks["pf1ClassLevelChange"];
export declare const pf1DisplayCard: Hooks.StaticCallbacks["pf1DisplayCard"];

// Action
export declare const pf1CreateActionUse: Hooks.StaticCallbacks["pf1CreateActionUse"];
export declare const pf1PostActionUse: Hooks.StaticCallbacks["pf1PostActionUse"];
export declare const pf1PreActionUse: Hooks.StaticCallbacks["pf1PreActionUse"];
export declare const pf1PreDisplayActionUse: Hooks.StaticCallbacks["pf1PreDisplayActionUse"];

// Changes
export declare const pf1GetChangeFlat: Hooks.StaticCallbacks["pf1GetChangeFlat"];
export declare const pf1AddDefaultChanges: Hooks.StaticCallbacks["pf1AddDefaultChanges"];

// Migration
export declare const pf1MigrationStarted: Hooks.StaticCallbacks["pf1MigrationStarted"];
export declare const pf1MigrationFinished: Hooks.StaticCallbacks["pf1MigrationFinished"];

// Sheet Events
export declare const pf1DropContainerSheetData: Hooks.StaticCallbacks["pf1DropContainerSheetData"];

// Item Links
export declare const pf1CreateItemLink: Hooks.StaticCallbacks["pf1CreateItemLink"];
export declare const pf1DeleteItemLink: Hooks.StaticCallbacks["pf1DeleteItemLink"];

// Roll Data
export declare const pf1GetRollData: Hooks.StaticCallbacks["pf1GetRollData"];

// Combat
export declare const pf1CombatTurnSkip: Hooks.StaticCallbacks["pf1CombatTurnSkip"];

// Dynamic hooks

// Registry
export import pf1RegisterRegistry = Hooks.pf1RegisterRegistry;
