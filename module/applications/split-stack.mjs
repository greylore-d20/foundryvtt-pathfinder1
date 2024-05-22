/**
 * Stack splitting dialog
 *
 * @example
 * ```js
 * const result = await pf1.applications.SplitStack.wait({ title: "My Stuff", initial: 50, total: 100 });
 * if (!result) throw new Error("Fsck!");
 * const [keep,split] = result;
 * console.log(`I keep ${keep} and you get ${split}`);
 * ```
 */
export class SplitStack extends Dialog {
  /**
   * Wait for user interaction to finish.
   *
   * @param {object} options - Options
   * @param {string} [options.title] - Dialog title
   * @param {number} options.initial - Initial value
   * @param {number} options.total - Total value to split.
   * @param {number} [options.step] - Value stepping.
   * @param {string[]} [options.css] - Optional CSS selectors to add to the dialog.
   * @param {object} renderOptions - Render options to pass to Dialog
   * @returns {number[]|null} - Number tuple, to keep and to split values. Null if cancelled.
   */
  static async wait({ title, initial = 1, step = 1, total, css = [] } = {}, renderOptions = {}) {
    // Can't split
    if (total <= 1) return null;
    // Only one answer
    if (total == 2) return 1;

    step ||= 1;
    initial = Math.clamped(initial || 0, 1, total);
    const max = total - 1;

    const content = await renderTemplate("systems/pf1/templates/apps/split-stack.hbs", {
      initial,
      keep: total - initial,
      max,
    });

    return super.wait(
      {
        title,
        content,
        buttons: {
          split: {
            // icon: `<i class="fas fa-people-arrows></i>`,
            label: game.i18n.localize("PF1.Split"),
            callback: async ([html]) => {
              const splitValue = Math.clamped(html.querySelector(`input.split`).valueAsNumber, 1, max);
              if (Number.isNumeric(splitValue)) {
                return [Math.max(1, total - splitValue), splitValue];
              }
              return null;
            },
          },
        },
        render: ([html]) => {
          const slider = html.querySelector("input.slider");
          const oldstack = html.querySelector("input.left");
          const newstack = html.querySelector("input.split");
          slider.addEventListener(
            "input",
            (ev) => {
              const newval = ev.target.valueAsNumber;
              newstack.value = newval;
              oldstack.value = total - newval;
            },
            { passive: true }
          );
          newstack.addEventListener(
            "input",
            (ev) => {
              let newval = ev.target.valueAsNumber;
              if (newval > max) {
                newstack.value = max;
                newval = max;
              } else if (newval < 1) {
                newstack.value = 1;
                newval = 1;
              }
              slider.value = newval;
              oldstack.value = total - newval;
            },
            { passive: true }
          );
          oldstack.addEventListener("input", (ev) => {
            let newval = total - ev.target.valueAsNumber;
            if (newval > total) {
              oldstack.value = max;
              newval = 1;
            } else if (newval < 1) {
              oldstack.value = 1;
              newval = max;
            }
            newstack.value = newval;
            slider.value = newval;
          });
        },
        close: () => null,
        default: "split",
      },
      {
        classes: [...Dialog.defaultOptions.classes, "pf1", "split-stack", ...css],
      },
      renderOptions
    );
  }
}
