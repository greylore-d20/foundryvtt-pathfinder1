/**
 * Calls a deprecated hook, logging a warning if any callbacks are registered for it.
 *
 * @param {string} oldHook - The name of the deprecated hook to be called
 * @param {string} newHook - The name of the new hook to use instead
 * @param {boolean} allowed - The result of a previous {@link Hooks.call}. If false, the deprecated hook will not be called,
 *   as the return value of the hook has already been determined by a previous callback.
 * @param {any} [args] - The arguments to pass to the deprecated hook
 * @returns {boolean} - The return value of the call
 */
export const callOldNamespaceHook = (oldHook, newHook, allowed, ...args) => {
  if (Hooks.events[oldHook]?.length > 0) {
    foundry.utils.logCompatibilityWarning(
      `This usage of the ${oldHook} hook has been deprecated in favor of ${newHook}.`,
      {
        since: "PF1 0.82.0",
        until: "PF1 0.83.0",
      }
    );
  }
  // A previous callback has already returned false
  if (allowed === false) return false;
  return Hooks.call(oldHook, ...args);
};

/**
 * Calls a deprecated hook, logging a warning if any callbacks are registered for it.
 *
 * @param {string} oldHook - The name of the deprecated hook to be called
 * @param {string} newHook - The name of the new hook to use instead
 * @param {any} [args] - The arguments to pass to the deprecated hook
 * @returns {boolean} - The return value of the call
 */
export const callOldNamespaceHookAll = (oldHook, newHook, ...args) => {
  if (Hooks.events[oldHook]?.length > 0) {
    foundry.utils.logCompatibilityWarning(
      `This usage of the ${oldHook} hook has been deprecated in favor of ${newHook}.`,
      {
        since: "PF1 0.82.0",
        until: "PF1 0.83.0",
      }
    );
  }
  return Hooks.callAll(oldHook, ...args);
};
