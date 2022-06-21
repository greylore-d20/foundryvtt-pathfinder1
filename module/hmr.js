if (import.meta.hot) {
  // Handle
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
}
