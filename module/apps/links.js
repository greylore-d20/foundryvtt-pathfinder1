import cytoscape from "../cytoscape.js";

export class LinksApp extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pf1", "links"],
      title: "Links",
      template: "systems/pf1/templates/apps/links.html",
      width: 480,
      height: 560,
      submitOnClose: true,
    });
  }

  get edgeHandlesConf() {
    return {
      edgeType: (sn, tn) => {
        return this.edgeType(sn, tn);
      },
      complete: (sn, tn, el) => {
        el.addClass(this.edgeClasses);
      },
    };
  }

  get edgeClasses() {
    return ["save", "cmd"];
  }

  get cxtMenuConf() {
    return {
      selector: ".cmd",
      commands: this.cxtCommands.bind(this),
    };
  }

  get attribute() {
    return this.options.name;
  }

  get actor() {
    if (this.object instanceof Actor) return this.object;
    return this.object.actor;
  }

  get cyHTML() {
    return $(this.form).find(".cytoscape")[0];
  }

  getDefaultNodeData(o) {
    if (o instanceof Actor) {
      let id = o === this.actor ? "thisActor" : o._id;
      return {
        id: id,
      };
    }
    else if (o instanceof Item) {
      let id = o === this.object ? "this" : o._id;
      return {
        id: id,
      };
    }
    return {};
  }

  getStyle() {
    return [
      {
        selector: "node.item",
        style: {
          "background-fit": "contain",
          "background-color": "#666",
          "width": 100,
          "height": 100,
          "border-width": 4,
        },
      },
      {
        selector: "edge",
        style: {
          "curve-style": "bezier",
          "target-arrow-shape": "triangle",
        },
      },
      {
        selector: ".eh-handle",
        style: {
          "background-color": "red",
          "width": 12,
          "height": 12,
          "shape": "ellipse",
          "overlay-opacity": 0,
          "border-width": 12,
          "border-opacity": 0,
        },
      },
    ];
  }

  async fetchData() {
    // Get links
    this.links = JSON.parse(getProperty(this.object.data, this.attribute) || "[]");
    
    // Update links if outdated
    for (let a = 0; a < this.links.length; a++) {
      let n = this.links[a];
      if (n.id == null) continue;

      const item = await this.getItem(n.id);
      if (item != null) {
        this.links[a] = mergeObject(this.getDefaultNodeData(item), n);
      }
    }
  }

  toJSON() {
    let result = [];

    const nodes = this.cy.nodes(".save");
    const edges = this.cy.$(".save");

    // Add nodes
    for (let n of nodes) {
      let data = n.data();
      delete data.item;

      result.push({
        group: "nodes",
        data: n.data(),
        position: n.position(),
        classes: ["save"],
      });
    }
    // Add edges
    for (let e of edges) {
      result.push({
        group: "edges",
        data: e.data(),
        classes: this.edgeClasses,
      });
    }

    return JSON.stringify(result);
  }

  _updateObject(event, formData) {
    const updateData = {};

    const result = this.toJSON();
    updateData[this.attribute] = result;

    this.object.update(updateData); 
  }

  async activateListeners(html) {

    await this.fetchData();

    // Initialize cytoscape
    this.cy = cytoscape({
      container: html.find(".cytoscape")[0],
      style: this.getStyle(),
      elements: this.links || [],
      layout: {
        name: "preset",
      },
    });

    // Cytoscape resize
    this.cy.one("resize", this._onCytoscapeResize.bind(this));

    // Cytoscape update
    this.cy.on("add", ev => { this._updateItemInfo(); });

    // Add initial node
    if (this.cy.nodes().length === 0) {
      this.addNodeFromItem(this.object);
    }

    // Drop handler
    this.cyHTML.addEventListener("drop", this._handleCytoscapeDrop.bind(this));

    // Initialize cytoscape-edgehandles
    this.cy.edgehandles(this.edgeHandlesConf);

    // Initialize cytoscape-cxtmenu
    this.cy.cxtmenu(this.cxtMenuConf);

    // Initialize item data
    this._updateItemInfo();
  }

  _onCytoscapeResize(event) {
    const cy = this.cy;

    // Pan to center
    cy.fit();
  }

  async _handleCytoscapeDrop(event) {
    event.preventDefault();

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (e) {
      return false;
    }

    // Determine position to drop to
    const pan = this.cy.pan();
    let pos = {
      x: event.offsetX - pan.x,
      y: event.offsetY - pan.y,
    };

    // Case 1 - Import from a Compendium pack
    if (data.pack) {
      let id = `${data.pack}.${data.id}`;
      let item = await this.getItem(id);

      if (item == null) return false;
      if (!this.canAddItem(item)) return false;

      try {
        this.cy.add({
          group: "nodes",
          data: {
            id: id,
          },
          position: pos,
        });
      } catch (e) {
        return false;
      }
    }

    // Case 2 - Import from current actor
    else if (data.actorId != null) {
      if (!this.actor || this.actor._id !== data.actorId) return false;

      let item = this.actor.items.get(data.data._id);
      if (item == null) return false;
      if (!this.canAddItem(item)) return false;

      try {
        this.cy.add({
          group: "nodes",
          data: {
            id: item._id,
          },
          position: pos,
        });
      } catch (e) {
        return false;
      }
    }

    // Case 3 - Import from World entity
    else {
      let type = "Item";
      let item = game.items.get(data.id);
      let actor;
      if (!item) {
        actor = game.actors.get(data.id);
        type = "Actor";
      }
      if (!actor) return false;
      if (!this.canAddItem(item != null ? item : actor)) return false;

      try {
        this.cy.add({
          group: "nodes",
          data: {
            id: `${type}.${data.id}`,
          },
          position: pos,
        });
      } catch (e) {
        return false;
      }
    }
  }

  async _updateItemInfo() {
    // Update nodes
    for (let n of this.cy.nodes()) {
      const item = await this.getItem(n.id());
      if (item != null) {
        this._setNodeInfo(n, item);
      }
    }

    // Update edges
    for (let e of this.cy.edges(".save")) {
      this._setEdgeInfo(e);
    }
  }

  _setNodeInfo(n, item) {
    n.css("background-image", item.img);
    n.css("label", item.compendium == null ? item.name : `${item.name} [Compendium]`);
    n.css("border-color", item.typeColor || "white");
    n.data("item", item);
    n.addClass(["item", "save", "cmd"]);
  }

  _setEdgeInfo(e) {
    const src = e.source();
    const target = e.target();
    const item = [src.data("item"), target.data("item")];

    // Set minimum level label
    {
      const minLevel = e.data("minLevel");
      if (minLevel != null) {
        e.css("label", game.i18n.localize("PF1.LinkMinLevelLabel").format(minLevel));
      }
    }
  }

  addNodeFromItem(item) {
    this.cy.add({
      group: "nodes",
      data: this.getDefaultNodeData(item),
      position: {
        x: 0,
        y: this.cy.nodes().length === 0 ? 0 : 120,
      },
    });
  }

  async getItem(id) {
    const arr = id.split(".");
    // Return form item
    if (arr.length === 1 && arr[0] === "this") {
      return this.object;
    }
    // Return form item's actor
    else if (arr.length === 1 && arr[0] === "thisActor") {
      return this.actor;
    }
    // Return item from associated actor
    else if (arr.length === 1 && this.actor != null) {
      return this.actor.items.find(o => o._id === arr[0]);
    }
    // Get world entity
    else if (arr.length === 2) {
      // Return world actor
      if (arr[0] === "Actor") {
        return game.actors.entities.find(o => o._id === arr[1]);
      }
    }
    // Get compendium entry
    else if (arr.length === 3) {
      const collection = arr.slice(0, 2).join(".");
      const pack = game.packs.get(collection);
      const src = await pack.getEntity(arr[2]);
      return src;
    }

    return null;
  }

  setPosition(...args) {
    super.setPosition(...args);
    if (this.cy != null) {
      this.cy.resize();
    }
  }

  edgeType(src, target) {
    let item = [src.data("item"), target.data("item")];
    if (!item[0] || !item[1]) return null;

    // Allow Class to Feature linking
    if (item[0].type === "class" && item[1].type === "feat") return "flat";

    return null;
  }

  canAddItem(item) {
    return true;
  }

  cxtCommands(n) {
    if (n.isEdge()) {
      return this.getEdgeCommands(n);
    }
    else if (n.isNode()) {
      return this.getNodeCommands(n);
    }

    return [];
  }

  getNodeCommands(n) {
    let item = n.data("item"),
      app = this,
      cy = this.cy,
      result = [];

    // Remove node
    result.push({
      fillColor: "red",
      content: '<span class="fas fa-trash"></span>',
      select: n => {
        cy.remove(n);
      },
    });

    return result;
  }

  getEdgeCommands(e) {
    // Prepare data
    let result = [];
    let cy = this.cy;

    // Remove edge
    result.push({
      fillColor: "red",
      content: '<span class="fas fa-trash"></span>',
      select: e => {
        cy.remove(e);
      },
    });

    return result;
  }
}
