#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const Config = require("../config");
const TokenListAPI = require("../apis/tokenlist");
const Interaction = require("../interaction");
const Erc20ABI = require("../abis/erc20.json");
const MakerV2ABI = require("../abis/makerv2.json");
const FactoryABI = require("../abis/factory.json");
const MoraABI = require("../abis/mora.json");
const { BigNumber } = require("ethers");

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const _0 = BigNumber.from("0");
const _10e18 = BigNumber.from((10**18).toString());
const chainId = Config.getConfig().chainId;
const factoryAddress = Config.getConfig().factoryAddress;
const moraAddress = Config.getConfig().moraAddress;
const xmoraAddress = Config.getConfig().xmoraAddress;
const makerv2Address = Config.getConfig().makerv2Address;
const eth = Interaction.getEth();

var executedPair = [];
var failedPair = [];

async function convert(account, makerv2, pair, token0, token1) {
    if (pair && pair !== "0x0000000000000000000000000000000000000000" && !executedPair.includes(pair) && !failedPair.includes(pair)) {
        const pairName = token0.symbol + "-" + token1.symbol;
        try {
            // const erc20 = Interaction.getContract(pair, Erc20ABI, account);
            // console.log("Checking balance of pair", pair);
            // const lpBalance = await erc20.balanceOf(makerv2.address);
            // console.log("Balance:", lpBalance);
            // if (lpBalance.div(_10e18).toNumber() > 0) {
                console.log("Start converting " + pairName + " (" + pair + ")");
                // var nonce = await eth.getTransactionCount(account.address);
                const tx = await makerv2.convert(token0.address, token1.address);
                console.log("Successfully convert " + pairName, tx.hash);
            // }
            executedPair.push(pair);
            console.log("Completed executing pair", pair);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        catch (e) {
            failedPair.push(pair);
            console.log("Failed to convert " + pairName);
            // console.log(e);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    else {
        console.log("Pair does not exist or has been executed/failed", pair);
    }
}

function calculateApr(db, dt, bal) {
    return ((db * 31536000 / dt)) / bal.div(_10e18).toNumber();
}

module.exports.start = async (account) => {
    try {
        const aprFile = path.join(process.cwd(), "./results/apr.json");
        const contents = await readFileAsync(aprFile);
        const { timestamp, deltaBalance, apr, boughtbackMora } = JSON.parse(contents.toString());

        const tokenlist = await TokenListAPI.get(chainId);
        // console.log(tokenlist);
        const factory = Interaction.getContract(factoryAddress, FactoryABI, account);
        const mora = Interaction.getContract(moraAddress, MoraABI, account);
        const initBalance = await mora.balanceOf(xmoraAddress);

        const makerv2 = Interaction.getContract(makerv2Address, MakerV2ABI, account);

        const newTimestamp = new Date().getTime() / 1000;
        const deltaTimestamp = newTimestamp - timestamp;
        console.log("deltaTimestamp", deltaTimestamp);

        var newDeltaBalance = 0;
        var newApr = apr;

        for (let i = 0; i < tokenlist.length; i++) {
            for (let j = 0; j < tokenlist.length; j++) {
                const token0 = tokenlist[i];
                const token1 = tokenlist[j];
                if (token0.address && token1.address && token0.address !== token1.address) {
                    const pair = await factory.getPair(token0.address, token1.address);
                    const balance = await mora.balanceOf(xmoraAddress);
                    await convert(account, makerv2, pair, token0, token1);
                    const newBalance = await mora.balanceOf(xmoraAddress);
                    newDeltaBalance = newDeltaBalance + newBalance.div(_10e18).toNumber() - balance.div(_10e18).toNumber();
                    console.log("deltaBalance", newDeltaBalance);
                    newApr = calculateApr(newDeltaBalance, deltaTimestamp, initBalance);
                    console.log("newApr", newApr);
                }
            }
        }

        await writeFileAsync(aprFile, JSON.stringify({
            lastTimestamp: timestamp,
            lastApr: apr,
            timestamp: newTimestamp,
            apr: newApr,
            boughtbackMora: boughtbackMora + newDeltaBalance
        }));

        console.log("Failed pairs: " + failedPair.toString());
    }
    catch (e) {
        console.log(e);
    }
};