#!/usr/bin/env node
"use strict";

const Config = require("./config");
const Interaction = require("./interaction");
const Maker = require("./actions/maker");

const start = async () => {
  await Config.checkConfig();
  const account = Interaction.getAccount();
  
  await Maker.start(account);
};

(async () => {
  try {
    await start();
  } catch (e) {
    console.error(e);
  }
})();
