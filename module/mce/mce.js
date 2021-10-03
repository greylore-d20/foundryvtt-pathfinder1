export const tinyMCEInit = function () {
  CONFIG.TinyMCE.content_css.push("/systems/pf1/ui/mce.css");

  CONFIG.TinyMCE.style_formats[0].items.push(
    {
      title: game.i18n.localize("PF1.NotImplemented"),
      inline: "span",
      classes: "notImp",
      attributes: { title: game.i18n.localize("PF1.NotImplemented") },
      remove: "all",
    },
    {
      title: game.i18n.localize("PF1.StepsRequired"),
      inline: "span",
      classes: "needSteps",
      attributes: { title: game.i18n.localize("PF1.StepsRequired") },
      remove: "all",
    }
  );
  CONFIG.TinyMCE.formats = Object.assign({}, CONFIG.TinyMCE.formats, {
    removeFormat: [{ selector: "span", classes: "notImp,needSteps", remove: "all" }],
  });

  tinyMCE.on("addeditor", (ev) => {
    registerContextMenu(ev.editor);
  });
};

/**
 * @param editor
 */
function registerContextMenu(editor) {
  const isInfoElement = function (node) {
    if (node.nodeName.toLowerCase() !== "span") node = node.parentNode;
    return (
      node.nodeName.toLowerCase() === "span" &&
      (node.classList.contains("notImp") || node.classList.contains("needSteps"))
    );
  };

  const getInfoElement = function () {
    const node = editor.selection.getNode();
    return isInfoElement(node) ? node.closest("span.notImp,span.needSteps") : null;
  };

  editor.ui.registry.addContextForm("info-form", {
    launch: {
      type: "contextformtogglebutton",
      icon: "warning",
    },
    label: "Info",
    predicate: isInfoElement,
    initValue: function () {
      const elm = getInfoElement();
      return elm ? elm.title : "";
    },
    commands: [
      {
        type: "contextformtogglebutton",
        icon: "warning",
        tooltip: game.i18n.localize("PF1.NotImplemented"),
        onSetup: function (buttonApi) {
          buttonApi.setActive(!!getInfoElement()?.classList.contains("notImp"));
          const nodeChangeHandler = function () {
            buttonApi.setActive(!editor.readonly && getInfoElement()?.classList.contains("notImp"));
          };
          editor.on("nodechange", nodeChangeHandler);
          return function () {
            editor.off("nodechange", nodeChangeHandler);
          };
        },
        onAction: function (formApi) {
          const value = formApi.getValue(),
            node = getInfoElement();
          editor.setDirty(true);
          editor.dom.setAttribs(node, { title: value, class: "notImp" });
          formApi.hide();
        },
      },
      {
        type: "contextformtogglebutton",
        icon: "selected",
        tooltip: game.i18n.localize("PF1.StepsRequired"),
        onSetup: function (buttonApi) {
          buttonApi.setActive(!!getInfoElement()?.classList.contains("needSteps"));
          const nodeChangeHandler = function () {
            buttonApi.setActive(!editor.readonly && getInfoElement()?.classList.contains("needSteps"));
          };
          editor.on("nodechange", nodeChangeHandler);
          return function () {
            editor.off("nodechange", nodeChangeHandler);
          };
        },
        onAction: function (formApi) {
          const value = formApi.getValue(),
            node = getInfoElement();
          editor.setDirty(true);
          editor.dom.setAttribs(node, { title: value, class: "needSteps" });
          formApi.hide();
        },
      },
      {
        type: "contextformtogglebutton",
        icon: "close",
        tooltip: game.i18n.localize("PF1.RemoveInfo"),
        onAction: function (formApi) {
          const node = getInfoElement();
          editor.setDirty(true);
          editor.dom.remove(node, true);
          formApi.hide();
        },
      },
    ],
  });
}
