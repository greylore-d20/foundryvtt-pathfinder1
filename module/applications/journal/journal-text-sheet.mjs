/**
 * Journal text page sheet that displays parentage with sub-pages
 */
export class JournalTextPageSheetPF1 extends JournalTextPageSheet {
  get template() {
    if (this.document.type !== "text" || this.isEditable) return super.template;
    return "systems/pf1/templates/journals/text-view.hbs";
  }

  async getData() {
    const context = await super.getData();

    // Find parent pages if deeper than level 1 heading
    const current = this.document;
    const level = current.title.level;
    if (level > 1 && current.parent instanceof JournalEntry) {
      /** @type {JournalEntryPage[]} */
      const pages = current.parent.pages.contents.sort((a, b) => a.sort - b.sort);

      // Find headers
      let h1, h2;
      for (const page of pages) {
        if (page === current) break;
        if (page.title.level === 1) {
          h1 = page;
          h2 = undefined;
        } else if (level > 2 && page.title.level === 2) {
          h2 = page;
        }
      }

      context.pf1 = {
        h1,
        h2,
      };
    }

    return context;
  }
}
