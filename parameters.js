"use strict";

const path = require("path");

const parameters = {
  configFileName: path.join(process.cwd(), "maker.config.json"),
  configQuestions: [
    {
      type: "input",
      name: "provider",
      message: "Enter the URL of web3 provider",
      default: "http://localhost:8545"
    },
    {
      type: "input",
      name: "chainId",
      message: "Enter the chain ID of web3 provider",
      default: 1
    },
    {
      type: "input",
      name: "moraAddress",
      message: "Contract address of Mora"
    },
    {
      type: "input",
      name: "xmoraAddress",
      message: "Contract address of xMora"
    },
    {
      type: "input",
      name: "makerv2Address",
      message: "Contract address of MoraMaker"
    }
  ]
};

module.exports.get = () => {
  return parameters;
};
