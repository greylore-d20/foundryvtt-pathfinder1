import { AbstractDocumentSelector } from "@app/abstract-document-selector.mjs";

/**
 * A specialized form application for selecting an Item from a list of available choices
 *
 * @augments {AbstractDocumentSelector}
 */
export class ItemSelector extends AbstractDocumentSelector {
  static DEFAULT_OPTIONS = {
    actor: undefined,
    items: undefined,
    filterFunc: undefined,
    selected: null,
    window: {
      title: "PF1.Application.ItemSelector.Title",
    },
    includeNone: true,
  };

  /* -------------------------------------------- */

  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    options.items ||= options.actor?.items || [];
    return options;
  }

  /* -------------------------------------------- */

  async _getSections() {
    let itemList = this.options.filterFunc
      ? this.options.items.filter(this.options.filterFunc)
      : [...this.options.items];

    if (this.options.search.value) {
      itemList = itemList.filter((item) => item.name.toLowerCase().includes(this.options.search.value.toLowerCase()));
    }

    itemList.sort((a, b) => a.name.localeCompare(b.name));

    itemList = itemList.map((item) => {
      return {
        id: item.id,
        name: item.name,
        img: item.img,
        isOwner: item.actor?.isOwner || false,
        extras: [
          {
            label: "PF1.Application.ItemSelector.Quantity",
            value: item.system.quantity,
          },
        ],
      };
    });

    return [
      {
        id: "items",
        label: "PF1.Application.ItemSelector.Items",
        documents: itemList,
      },
    ];
  }
}

/**
 * @typedef ItemSelectorOptions
 * @param {object} [actor] - Actor from which to get items from.
 * @param {Item[]} [items] - Item list to get item from. Used only if actor is undefined.
 * @param {Function<Item>} [filterFunc] - Filtering callback function.
 */
