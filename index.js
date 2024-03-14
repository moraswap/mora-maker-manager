#!/usr/bin/env node
"use strict";

const Config = require("./config");
const Interaction = require("./interaction");
const MakerV2 = require("./actions/makerv2");
const MakerV3 = require("./actions/makerv3");

const start = async () => {
  await Config.checkConfig();
  const account = Interaction.getAccount();
  
  await MakerV3.start(account);
  await MakerV2.start(account);
  console.log("Converted all protocol fee successfully");
};

(async () => {
  try {
    await start();
  } catch (e) {
    console.error(e);
  }
})();
