import pc from "picocolors";

/**
 * A utility class wrapping a {@link import("vite").Logger} instance to provide uniform log formatting
 */
export class ViteLoggerPF {
  /** Common prefix for all log messages */
  static prefixBase = pc.bold("[PF1]");

  /**
   * @param {import("vite").Logger} [logger] - The logger to be used
   */
  constructor(logger) {
    /**
     * The logger used by this instance to log messages
     *
     * @type {import("vite").Logger}
     */
    this.logger = logger;
  }

  /**
   * Returns the current time in the localised format
   *
   * @type {string}
   */
  static getTime() {
    return `${pc.dim(new Date().toLocaleTimeString())}`;
  }

  /**
   * Returns the common prefix for all log messages, optionally colored to signal the severity
   *
   * @param {import("picocolors/types").Formatter} [color=pc.blue] - The color to use for the prefix
   * @returns {string} The full, formatted prefix
   */
  static prefix(color = pc.blue) {
    return `${pc.dim(this.getTime())} ${color(this.prefixBase)}`;
  }

  /**
   * Logs an info message to a {@link import("vite").Logger}
   *
   * @param {string} message - message to be logged
   * @returns {void}
   */
  info(message) {
    this.logger.info(`${this.constructor.prefix()} ${message}`);
  }

  /**
   * Logs a warning message to a {@link import("vite").Logger}
   *
   * @param {string} message - message to be logged
   * @returns {void}
   */
  warn(message) {
    this.logger.warn(`${this.constructor.prefix(pc.yellow)} ${message}`);
  }

  /**
   * Logs an error message to a {@link import("vite").Logger}
   *
   * @param {string} message - message to be logged
   * @returns {void}
   */
  error(message) {
    this.logger.error(`${this.constructor.prefix(pc.red)} ${message}`);
  }
}
