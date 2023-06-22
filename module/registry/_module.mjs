/**
 * This module contains all registry classes as well as their entry `DataModel`s.
 * Additionally, it contains the singleton registries for each registry class.
 * The singleton registries are accessible as `pf1.registry.<registryName>` at runtime.
 * Their exports in this module however are empty – they only exist for documentation purposes.
 *
 * @module
 */
export * from "./base-registry.mjs";
export * from "./damage-types.mjs";
export * from "./script-call.mjs";
