// Document link attribute stuffing
{
  const origFunc = TextEditor._createContentLink;
  TextEditor._createContentLink = async function (match, { relativeTo } = {}) {
    const [type, target, hash, name] = match.slice(1, 5);
    const a = await origFunc.call(this, match, { relativeTo });
    if (name?.indexOf("::") > -1) {
      const args = name.split("::"),
        label = args.pop();
      if (args.length) {
        args.forEach((o) => {
          let [key, value] = o.split(/(?<!\\):/);
          if (!(key && value)) {
            value = key;
            key = "extra";
          }
          switch (key) {
            case "icon":
              a.firstChild.className = "fas fa-" + value;
              break;
            case "class":
              a.classList.add(...value.split(" "));
              break;
            default:
              a.setAttribute("data-" + key, value);
          }
        });
        a.lastChild.textContent = label;
      }
    }
    return a;
  };
}

// Patch the `fromData` method used by Foundry to allow rolls from builds with a renamed roll class
// to still be created from JSON for tooltips etc.
// Introduced in v0.81.1 for Foundry v9.269
{
  const origFunc = Roll.fromData;
  Roll.fromData = function (data, ...args) {
    if (data.class === "RollPF$1") data.class = "RollPF";
    return origFunc.call(this, data, ...args);
  };
}

/**
 * Patch ImagePopout image share handling function to respect identified status of items
 *
 * Synchronized with Foundry VTT v12.331
 *
 * HACK: This breaks Foundry API by turning it into async function, but since this is a socket handler, that should not matter.
 *
 * @see https://github.com/foundryvtt/foundryvtt/issues/8953
 */
{
  const original_handleShareImage = ImagePopout._handleShareImage;
  ImagePopout._handleShareImage = async function ({ image, title, caption, uuid, showTitle } = {}) {
    const doc = await fromUuid(uuid);
    if (doc instanceof Item) {
      title = doc.name;
    }

    return original_handleShareImage.call(this, { image, title, caption, uuid, showTitle });
  };
}

/**
 * Stop releasing modifiers on HTMLButtonElement. Check again on proper support of popouts. How blur is handled will have to be reevaluated
 *
 * Introduced Foundry VTT v10.291
 * Still needed with v12.331
 */
{
  const original_onFocusIn = KeyboardManager.prototype._onFocusIn;
  KeyboardManager.prototype._onFocusIn = function (event) {
    const formElements = [HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement, HTMLOptionElement];

    if (event.target.isContentEditable || formElements.some((cls) => event.target instanceof cls)) {
      this.releaseKeys();
    }
  };

  Object.defineProperty(KeyboardManager.prototype, "hasFocus", {
    get() {
      // Pulled from https://www.w3schools.com/html/html_form_elements.asp
      const formElements = ["input", "select", "textarea", "option", "[contenteditable]"];
      const selector = formElements.map((el) => `${el}:focus`).join(", ");
      return document.querySelectorAll(selector).length > 0;
    },
  });
}
