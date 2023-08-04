// This if enables following code to be tree-shaken away when not using the development server
if (import.meta.hot) {
  // Handle hot reloading of handlebars templates
  import.meta.hot.on("hotHandle:update", ({ file, content }) => {
    const compiled = Handlebars.compile(content);
    Handlebars.registerPartial(file, compiled);
    _templateCache[file] = compiled;
    console.log(`PF1 | Compiled template ${file}`);

    // Rerender opened applications to make use of updated templates
    for (const appId in ui.windows) {
      ui.windows[Number(appId)].render(true);
    }
  });

  /**
   * Apply a given translation to Foundry's i18n cache (or fallback)
   *
   * @param {Record<string, unknown>} content - The content that will be merged into the i18n cache
   * @param {boolean} fallback - Whether to merge content into the main translations cache or the fallback cache
   */
  const applyTranslation = (content, fallback = false) => {
    const target = fallback ? game.i18n._fallback : game.i18n.translations;
    target.PF1 = {};
    foundry.utils.mergeObject(target, content);
    const displayLanguage = fallback
      ? "localization fallback"
      : `localization file systems/pf1/lang/${game.i18n.lang}.json`;
    console.log(`PF1 | Applied ${displayLanguage}`);
  };

  import.meta.hot.on(
    "hotLangs:update",
    /** @param {{language: string, content: Record<string, unknown>}} languageData - An array containing languages and their i18n content */
    (languageData) => {
      const lang = game.i18n.lang;

      // Apply translation if it exists
      if (lang === languageData.language) applyTranslation(languageData.content);

      // Apply English as fallback if it exists
      if (lang !== "en" && languageData.language === "en") {
        applyTranslation(languageData.content, true);
      }

      // Rerender opened applications to make use of updated translations
      for (const appId in ui.windows) {
        ui.windows[Number(appId)].render(true);
      }
    }
  );

  import.meta.hot.on("vite:beforeFullReload", () => {
    // HACK: Prevent _all_ full-reloading by throwing in callback if reloads are disabled
    if (import.meta.env.VITE_NO_RELOAD) {
      throw "Reload prevented, VITE_NO_RELOAD is set";
    }
  });
}
