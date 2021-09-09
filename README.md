# Pathfinder 1e for Foundry VTT

An implementation of the first edition of Pathfinder for Foundry Virtual
Tabletop (http://foundryvtt.com).

The software component of this system is distributed under the GNUv3 license
while the game content is distributed under the Open Gaming License v1.0a.

## Installation

Install the following game system in FoundryVTT's game system tab: [https://gitlab.com/Furyspark/foundryvtt-pathfinder1/-/raw/latest/system.json](https://gitlab.com/Furyspark/foundryvtt-pathfinder1/-/raw/latest/system.json)

If you wish to manually install the system, you must clone or extract it into the `Data/systems/pf1` folder.
You may do this by downloading a zip archive from the [Releases Page](https://gitlab.com/Furyspark/foundryvtt-pathfinder1/-/releases).

## Building

1. Clone or download this repository.
2. Change directory to the repository root and run `npm ci`.
3. Run `npm run build` to create a `dist` directory containing all files necessary to use the system in Foundry.
   3a. If you want to further edit files, run `npm run build:watch` to let the bundler watch for changes.

## Legal

"This system uses trademarks and/or copyrights owned by Paizo Inc., which are used under Paizo's Community Use Policy.
We are expressly prohibited from charging you to use or access this content.
This [website, character sheet, or whatever it is] is not published, endorsed, or specifically approved by Paizo Inc.
For more information about Paizo's Community Use Policy, please visit [paizo.com/communityuse](http://paizo.com/communityuse).
For more information about Paizo Inc. and Paizo products, please visit [paizo.com](https://paizo.com)."

## API

This system adds some hooks for modders to use.
Information on them can be found in [this repository's wiki](https://gitlab.com/Furyspark/foundryvtt-pathfinder1/-/wikis/API/Hooks).

## Information

You can view information on this game system [here](https://furyspark.gitlab.io/foundryvtt-pathfinder1-doc/).
While running the system in Foundry, you can find a Help browser in the Settings tab.
That information can also be found in [this repository's wiki](https://gitlab.com/Furyspark/foundryvtt-pathfinder1/-/wikis/Help/Home).
