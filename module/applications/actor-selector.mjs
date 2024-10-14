import { AbstractDocumentSelector } from "@app/abstract-document-selector.mjs";

/**
 * A specialized form application for selecting an Actor from a list of available choices
 *
 * @augments {AbstractDocumentSelector}
 */
export class ActorSelector extends AbstractDocumentSelector {
  static DEFAULT_OPTIONS = {
    actors: undefined,
    ownership: undefined,
    selected: null,
    window: {
      title: "PF1.Application.ActorSelector.Title",
    },
  };

  /* -------------------------------------------- */

  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    options.ownership ||= CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED;
    options.actors ||= [...game.actors];
    return options;
  }

  /* -------------------------------------------- */

  async _getSections() {
    let actorList = this.options.filterFunc ? this.options.actors.filter(this.filterFunc) : [...this.options.actors];

    actorList = actorList.filter((actor) => actor.testUserPermission(game.user, this.options.ownership));

    if (this.options.search.value) {
      actorList = actorList.filter((actor) =>
        actor.name.toLowerCase().includes(this.options.search.value.toLowerCase())
      );
    }

    actorList.sort((a, b) => a.name.localeCompare(b.name));

    actorList = actorList.map((actor) => {
      return {
        id: actor.id,
        name: actor.name,
        img: actor.img,
        isOwner: actor.isOwner,
        extras: [
          {
            label: "PF1.Application.ActorSelector.Owner",
            value: [...game.users]
              .filter((user) => actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER))
              .map((user) =>
                user.id === game.user.id ? game.i18n.localize("PF1.Application.ActorSelector.You") : user.name
              )
              .join(", "),
          },
        ],
      };
    });

    return [
      {
        id: "owned",
        label: "PF1.Application.ActorSelector.OwnedActors",
        documents: actorList.filter((actor) => actor.isOwner),
      },
      {
        id: "unowned",
        label: "PF1.Application.ActorSelector.UnownedActors",
        documents: actorList.filter((actor) => !actor.isOwner),
      },
    ];
  }
}

/**
 * @typedef ActorSelectorOptions
 * @property {Actor[]} [actors] - Actor list to choose from.
 * @property {Function<Actor>} [filterFunc] - Filtering callback function.
 * @property {string} [selected] - Already selected actor ID.
 * @param {*} [options.ownership=CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED] - Minimum Ownership level.
 */
