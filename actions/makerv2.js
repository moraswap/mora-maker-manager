#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const Config = require("../config");
const TokenListAPI = require("../apis/tokenlist");
const PriceAPI = require("../apis/price");
const Interaction = require("../interaction");
const Erc20ABI = require("../abis/erc20.json");
const MakerV2ABI = require("../abis/makerv2.json");
const FactoryABI = require("../abis/factory.json");
const MoraABI = require("../abis/mora.json");
const sMoraABI = require("../abis/smora.json");
const { BigNumber } = require("ethers");

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const _0 = BigNumber.from("0");
const _10e9 = BigNumber.from((10**9).toString());
const _10e18 = BigNumber.from((10**18).toString());
const chainId = Config.getConfig().chainId;
const factoryAddress = Config.getConfig().factoryAddress;
const moraAddress = Config.getConfig().moraAddress;
const rewardAddress = Config.getConfig().rewardAddress;
const smoraAddress = Config.getConfig().smoraAddress;
const makerv2Address = Config.getConfig().makerv2Address;
const eth = Interaction.getEth();

var executedPair = [];
var failedPair = [];

async function convert(account, makerv2, pair, token0, token1) {
    if (pair && pair !== "0x0000000000000000000000000000000000000000" && !executedPair.includes(pair) && !failedPair.includes(pair)) {
        const pairName = token0.symbol + "-" + token1.symbol;
        try {
            const erc20 = Interaction.getContract(pair, Erc20ABI, account);
            console.log("Checking balance of pair", pair);
            const lpBalance = await erc20.balanceOf(makerv2.address);
            console.log("Balance:", lpBalance);
            if (lpBalance.gt(_0)) {
                console.log("Start converting " + pairName + " (" + pair + ")");
                // var nonce = await eth.getTransactionCount(account.address);
                const tx = await makerv2.convert(token0.address, token1.address, "300");
                await tx.wait();
                console.log("Successfully convert " + pairName, tx.hash);
            }
            executedPair.push(pair);
            console.log("Completed executing pair", pair);
            // await new Promise(resolve => setTimeout(resolve, 2000));
        }
        catch (e) {
            failedPair.push(pair);
            console.log("Failed to convert " + pairName);
            console.log(e);
            // await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    else {
        console.log("Pair does not exist or has been executed/failed", pair);
    }
}

function calculateAnnualValueUsd(db, dt, p) {
    return db * p * (365 * 24 * 60 * 60) / dt;
}

module.exports.start = async (account) => {
    try {
        const infoFile = path.join(process.cwd(), "./results/info.json");
        const contents = await readFileAsync(infoFile);
        const { timestamp, deltaBalance, annualValueUsd, boughtbackToken } = JSON.parse(contents.toString());

        const tokenlist = await TokenListAPI.get(chainId);
        // console.log(tokenlist);
        const rewardPrice = await PriceAPI.get("solana");
        // const moraPrice = 0.03217;
        const factory = Interaction.getContract(factoryAddress, FactoryABI, account);
        // const mora = Interaction.getContract(moraAddress, MoraABI, account);
        const rewardToken = Interaction.getContract(rewardAddress, Erc20ABI, account);
        const initBalance = await rewardToken.balanceOf(smoraAddress);

        const smora = Interaction.getContract(smoraAddress, sMoraABI, account);
        const makerv2 = Interaction.getContract(makerv2Address, MakerV2ABI, account);

        const newTimestamp = new Date().getTime() / 1000;
        const deltaTimestamp = newTimestamp - timestamp;
        console.log("deltaTimestamp", deltaTimestamp);

        var newDeltaBalance = 0;
        var newAnnualValueUsd = annualValueUsd;

        for (let i = 0; i < tokenlist.length; i++) {
            for (let j = 0; j < tokenlist.length; j++) {
                const token0 = tokenlist[i];
                const token1 = tokenlist[j];
                if (token0.address && token1.address && token0.address !== token1.address) {
                    const pair = await factory.getPair(token0.address, token1.address);
                    // const balance = await makerv2.boughtMora();
                    // console.log("Old bought amount:", parseFloat(balance.toString()))
                    await convert(account, makerv2, pair, token0, token1);
                    const newBalance = await rewardToken.balanceOf(smoraAddress);
                    // console.log("New bought amount:", parseFloat(newBalance.toString()))
                    newDeltaBalance = (parseFloat(newBalance.toString()) - parseFloat(initBalance.toString())) / 10 ** 9;
                    console.log("deltaBalance", newDeltaBalance);
                    newAnnualValueUsd = calculateAnnualValueUsd(newDeltaBalance, deltaTimestamp, rewardPrice);
                    console.log("newAnnualValueUsd", newAnnualValueUsd);
                }
            }
        }

        const tx = await smora.updateReward(rewardAddress);
        await tx.wait();

        await writeFileAsync(infoFile, JSON.stringify({
            lastTimestamp: timestamp,
            lastAnnualValueUsd: annualValueUsd,
            timestamp: newTimestamp,
            annualValueUsd: newAnnualValueUsd,
            boughtbackToken: parseFloat((await makerv2.boughtTokenTo()).toString()) / 10 ** 9
        }));

        console.log("Failed pairs: " + failedPair.toString());
    }
    catch (e) {
        console.log(e);
    }
};