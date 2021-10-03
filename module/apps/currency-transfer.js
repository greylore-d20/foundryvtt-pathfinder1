export class CurrencyTransfer extends FormApplication {
  constructor(
    source = { actor: null, container: null, amount: {}, alt: false },
    dest = { actor: null, container: null, amount: {}, alt: false },
    options = {}
  ) {
    super(options);

    if (source.actor) {
      if (typeof source.actor === "string") source.actor = game.actors.get(source.actor);
      if (source.actor.data.type == "npc") source.alt = false;
    }
    if (source.container) {
      source.alt = false;
      if (typeof source.container === "string")
        source.container = source.actor ? source.actor.items.get(source.container) : game.items.get(source.container);
    }
    if (dest.actor) {
      if (typeof dest.actor === "string") dest.actor = game.actors.get(dest.actor);
      if (dest.actor.data.type == "npc") dest.alt = false;
      else if (dest.actor === source.actor && !source.container && !dest.container) dest.alt = !source.alt;
    }
    if (dest.container) {
      if (typeof dest.container === "string")
        dest.container = dest.actor ? dest.actor.items.get(dest.container) : game.items.get(dest.container);
    }

    // Currency checks
    if (source.container) {
      source.amount = mergeObject(source.container.data.data.currency, source.amount ?? {});
    } else if (source.actor) {
      source.amount = mergeObject(
        source.alt ? source.actor.data.data.altCurrency : source.actor.data.data.currency,
        source.amount ?? {}
      );
    } else if (game.user.isGM) {
      source.amount = mergeObject({ pp: "∞", gp: "∞", sp: "∞", cp: "∞" }, source.amount ?? {});
    } else {
      ui.notification.warning("Cannot use Infinite currency transfer as non-gm.");
      return undefined;
    }

    if (!dest.actor && !dest.container) return undefined;

    this.source = source;
    this.dest = dest;
  }

  get title() {
    let title;
    if (!this.source.actor) {
      if (this.source.container) title = this.source.container.name + " ";
      else title = "∞ ";
    } else {
      title = this.source.actor.name + " ";
      if (this.source.container) title += `(${this.source.container.name}) `;
    }
    title += "➤ ";
    if (this.source.actor == this.dest.actor && (this.source.alt || this.dest.alt))
      title += this.dest.alt ? game.i18n.localize("PF1.WeightlessCurrency") : game.i18n.localize("PF1.Currency");
    else {
      if (!this.dest.actor) title += this.dest.container.name;
      else {
        title += this.dest.actor.name;
        if (this.dest.container) title += ` (${this.dest.container.name})`;
      }
    }
    return title;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pf1", "currency-transfer"],
      template: "systems/pf1/templates/apps/currency-transfer.hbs",
      width: 380,
      height: 235,
    });
  }

  static get order() {
    return ["pp", "gp", "sp", "cp"]; // Object conversion ordering cannot be trusted in js
  }

  activateListeners(html) {
    html.find('button[type="submit"]').click(this._onSubmit.bind(this));

    html.find("button.cur-range").click(this._curRange.bind(this));

    html.find("input").on("input", this._calcTotal.bind(this));
    $(html.find("input")[0]).trigger("input");
  }

  _updateObject(event, formData) {
    this.dest.amount = {
      pp: formData.pp ?? 0,
      gp: formData.gp ?? 0,
      sp: formData.sp ?? 0,
      cp: formData.cp ?? 0,
    };
    this.constructor.transfer(
      this.source.container ? this.source.container : this.source.actor,
      this.dest.container ? this.dest.container : this.dest.actor,
      this.dest.amount,
      this.source.alt,
      this.dest.alt,
      2
    );
  }

  getData(_options = {}) {
    return {
      source: this.source,
      dest: this.dest,
      options: this.options,
      title: this.title,
      total:
        this.source.amount.gp === "∞"
          ? "∞"
          : this.constructor.order.reduce((acc, c, idx) => acc + this.source.amount[c] * 10 ** (1 - idx), 0),
    };
  }

  _curRange(ev) {
    ev.preventDefault();
    const button = ev.target.closest("button");
    const formField = button.closest(".form-fields");
    const min = button.classList.contains("down");
    const input = formField.querySelector("input");

    if (min) input.value = "";
    else input.value = formField.querySelector("span").textContent;
    $(input).trigger("input");
  }

  _calcTotal(ev) {
    const form = ev.target.closest(".currency-transfer");
    const amounts = Object.fromEntries(
      [...form.querySelectorAll("input")].map((o) => [o.name, parseInt(o.value || 0)])
    );
    const value = this.constructor.order.reduce((acc, c, idx) => acc + amounts[c] * 10 ** (1 - idx), 0);

    form.querySelector(".currency-total .form-fields label").textContent = Math.round(value * 100) / 100 + " gp";
  }

  async close(...args) {
    super.close(...args);
  }

  static _failed(i18nKey) {
    return ui.notifications.error(game.i18n.localize("PF1.CurrencyFailed") + game.i18n.localize(i18nKey));
  }

  static _directoryDrop(docDestId, event) {
    event.preventDefault();

    // try to extract the data
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
      if (data.type !== "Currency") return;
    } catch (err) {
      return false;
    }

    const destDoc = event.currentTarget.classList.contains("item")
      ? game.items.get(docDestId)
      : game.actors.get(docDestId);
    const sourceActor = data.tokenId ? game.actors.tokens[data.tokenId] : data.actorId;

    if (data.currency && sourceActor) {
      return new CurrencyTransfer(
        { actor: sourceActor, container: data.containerId, alt: data.alt },
        {
          actor: destDoc?.actor ?? destDoc,
          container: destDoc.data.type === "container" ? destDoc.id : null,
          amount: Object.fromEntries([[data.currency, parseInt(data.amount)]]),
        }
      ).render(true);
    }
  }

  /**
   * Transfer an amount of currency to a valid document
   *
   * @param {Document} sourceDoc ActorPF or ItemPF with currency
   * @param {Document} destDoc ActorPF or ItemPF with currency
   * @param {object|number} amount currency object containing transferred amount. Undefined keys will be assumed to be zero. Providing just a number will assume just gold
   * @param {boolean} sourceAlt Use alt currency on source
   * @param {boolean} destAlt Use alt currency on destination
   * @param {number} [allowConversion=false] Attempts to make change with sourceDoc's currency limit
   * @returns {boolean|object} false if failed, object containing amount transferred on success
   */
  static async transfer(sourceDoc, destDoc, amount, sourceAlt = false, destAlt = false, allowConversion = false) {
    if ((!sourceDoc && !game.user.isGM) || !destDoc || !amount) return false;

    if (typeof amount !== "object") amount = { gp: parseInt(amount) };

    this.order.forEach((c) => (amount[c] = amount[c] ?? 0));
    if (!Object.values(amount).find((a) => a > 0)) return this._failed("PF1.CurrencyInsufficient"), false;

    let sourceCurrency = duplicate(sourceAlt ? sourceDoc?.data.data.altCurrency : sourceDoc?.data.data.currency);
    const destCurrency = duplicate(destAlt ? destDoc.data.data.altCurrency : destDoc.data.data.currency);
    if ((!sourceCurrency && !game.user.isGM) || !destCurrency) return false;
    const originalSource = Object.assign(Object.fromEntries(this.order.map((o) => [o, Infinity])), sourceCurrency);

    const totalAmount = this.order.reduce((acc, c, idx) => acc + amount[c] * 10 ** (1 - idx), 0);
    const totalSource = this.order.reduce((acc, c, idx) => acc + sourceCurrency[c] * 10 ** (1 - idx), 0);

    if (totalAmount > totalSource) return this._failed("PF1.CurrencyInsufficient"), false;

    if (sourceCurrency) {
      this.order.some((a) => {
        const newSource = sourceCurrency[a] - amount[a];

        if (newSource < 0 && allowConversion) {
          amount = this.convert(originalSource, totalAmount, allowConversion);
          sourceCurrency = Object.fromEntries(this.order.map((o) => [o, originalSource[o] - amount[o]]));
          return true;
        } else sourceCurrency[a] = newSource;
      });
    }

    if (!amount || Object.values(sourceCurrency).find((c) => c < 0)) return false;

    if (!sourceDoc.testUserPermission(game.user, 3) || !destDoc.testUserPermission(game.user, 3)) {
      if (!game.users.find((o) => o.active && o.isGM)) return this._failed("PF1.CurrencyGMRequired"), false;
      game.socket.emit("system.pf1", {
        eventType: "currencyTransfer",
        data: {
          sourceActor: sourceDoc.actor?.uuid ?? sourceDoc.uuid,
          destActor: destDoc.actor?.uuid ?? destDoc.uuid,
          sourceContainer: sourceDoc.data.type === "container" ? sourceDoc.id : "",
          destContainer: destDoc.data.type === "container" ? destDoc.id : "",
          sourceAlt: sourceAlt,
          destAlt: destAlt,
          amount: amount,
        },
      });
      return amount;
    }

    this.order.forEach((c) => (destCurrency[c] += amount[c]));
    if (sourceDoc === destDoc)
      return sourceDoc.update({
        "data.altCurrency": sourceAlt ? sourceCurrency : destCurrency,
        "data.currency": destAlt ? sourceCurrency : destCurrency,
      });
    if (sourceAlt) sourceDoc.update({ "data.altCurrency": sourceCurrency });
    else sourceDoc.update({ "data.currency": sourceCurrency });
    if (destAlt) destDoc.update({ "data.altCurrency": destCurrency });
    else destDoc.update({ "data.currency": destCurrency });
    return amount;
  }

  /**
   * Convert totalAmount to a currency object containing
   *
   * @param {object} limit currency object containing max number of coins. Falsey values will assume infinity
   * @param {number|object} totalAmount currency as gold pieces. If provided as a currency object, will convert to gold
   * @returns {boolean|object} false if failed, currency object containing new amounts on conversion success
   */
  static convert(limit, totalAmount) {
    if (!limit) limit = Object.fromEntries(this.order.map((o) => [o, Infinity]));
    else limit = Object.assign({}, limit);
    if (typeof totalAmount !== "number")
      totalAmount = this.order.reduce((acc, cur, idx) => acc + totalAmount?.[cur] * 10 ** (1 - idx));
    if (!totalAmount) return false;
    const amount = {};
    totalAmount =
      this.order.reduce((acc, cur, idx) => {
        const minRequired = Math.min(limit[cur], Math.floor((acc % 10000) / 10 ** (3 - idx))), //Start from left to allow clumping
          inCopper = minRequired * 10 ** (3 - idx);
        amount[cur] = minRequired;
        limit[cur] -= minRequired;
        return acc - inCopper;
      }, totalAmount * 100) / 100; //Operate in copper pieces to avoid floating point errors
    if (totalAmount < 0) return false;
    return amount;
  }
}
