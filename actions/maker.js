#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const Config = require("../config");
const Interaction = require("../interaction");
const MakerABI = require("../abis/maker.json");
const MoraABI = require("../abis/mora.json");
const { BigNumber } = require("ethers");

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

module.exports.start = async (account) => {
    try {
        const _10e18 = BigNumber.from((10**18).toString());
        const aprFile = path.join(process.cwd(), "./results/apr.json");
        const contents = await readFileAsync(aprFile);
        const { timestamp, deltaBalance, apr } = JSON.parse(contents.toString());

        const moraAddress = Config.getConfig().moraAddress;
        const xmoraAddress = Config.getConfig().xmoraAddress;
        const mora = Interaction.getContract(moraAddress, MoraABI, account);
        const balance = await mora.balanceOf(xmoraAddress);

        const makerAddress = Config.getConfig().makerAddress;
        const maker = Interaction.getContract(makerAddress, MakerABI, account);

        const tx1 = await maker.convertMultiple(
            [
                "0x6dcDD1620Ce77B595E6490701416f6Dbf20D2f67", // MORA-NEON
                "0x6Ab1F83c0429A1322D7ECDFdDf54CE6D179d911f" // mUSDC-NEON
            ],
            [
                "0xf1041596da0499c3438e3B1Eb7b95354C6Aed1f5", // MORA-NEON
                "0xf1041596da0499c3438e3B1Eb7b95354C6Aed1f5" // mUSDC-NEON
            ]
        );
        const receipt1 = await tx1.wait();
        if (receipt1 && receipt1.blockNumber && receipt1.status === 1) { // 0 - failed, 1 - success
            console.log("Successfully convertMultiple ", tx1.hash);
            const newTimestamp = new Date().getTime() / 1000;
            console.log("newTimestamp", newTimestamp);
            const deltaTimestamp = newTimestamp - timestamp;
            console.log("deltaTimestamp", deltaTimestamp);

            const newBalance = await mora.balanceOf(xmoraAddress);
            console.log("balance", balance.div(_10e18).toNumber());
            console.log("newBalance", newBalance.div(_10e18).toNumber());
            const newDeltaBalance = newBalance.div(_10e18).toNumber() - balance.div(_10e18).toNumber();
            console.log("deltaBalance", newDeltaBalance);
            const newApr = ((newDeltaBalance * 31536000 / deltaTimestamp)) / balance.div(_10e18).toNumber();
            console.log("newApr", newApr);

            await writeFileAsync(aprFile, JSON.stringify({
                lastTimestamp: timestamp,
                lastDeltaBalance: deltaBalance,
                lastApr: apr,
                timestamp: newTimestamp,
                deltaBalance: newDeltaBalance,
                apr: newApr
            }));

            //   await new Promise(resolve => setTimeout(resolve, 10000));
        }

    }
    catch (e) {
        console.log(e);
    }
};