"use strict";

require('dotenv').config({ path: './.env' });
const Ethers = require("ethers");
const Web3 = require("web3");
const Config = require("./config").getConfig();
const web3 = new Web3(new Web3.providers.HttpProvider((Config || {}).provider || "http://localhost:8545"));
const customProvider = new Ethers.providers.JsonRpcProvider((Config || {}).provider || "http://localhost:8545");

module.exports.getEth = () => {
  return web3.eth;
};

module.exports.getAccount = () => {
  const wallet = new Ethers.Wallet(process.env.PRIVATE_KEY);
  const account = wallet.connect(customProvider);
  return account;
};

module.exports.getContract = (contractAddress, abi, account) => {
  const contract = new Ethers.Contract(contractAddress, abi, account);
  return contract;
};