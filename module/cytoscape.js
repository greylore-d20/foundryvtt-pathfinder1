const cytoscape = require("cytoscape");
const cxtmenu = require("cytoscape-cxtmenu");
const edgehandles = require("cytoscape-edgehandles");

cytoscape.use(cxtmenu);
cytoscape.use(edgehandles);

module.exports = cytoscape;
