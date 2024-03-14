#!/usr/bin/env node
"use strict";

const Config = require("../config");
const PairListAPI = require("../apis/pairlist");
const Interaction = require("../interaction");
const Erc20ABI = require("../abis/erc20.json");
const MakerV2ABI = require("../abis/makerv2.json");
const sMoraABI = require("../abis/smora.json");
const { BigNumber } = require("ethers");

const _0 = BigNumber.from("0");
const chainId = Config.getConfig().chainId;
const rewardAddress = Config.getConfig().rewardAddress;
const smoraAddress = Config.getConfig().smoraAddress;
const makerv2Address = Config.getConfig().makerv2Address;

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function convertMultiple(makerv2, batch) {
    console.log("Start converting batch", batch.pairs);
    const tx = batch.token0s.length > 1
                    ? await makerv2.convertMultiple(batch.token0s, batch.token1s, "3000")
                    : await makerv2.convert(batch.token0s[0], batch.token1s[0], "3000");
    console.log("Waiting for confirmations", tx.hash);
    await tx.wait();
    // await timeout(1000);
    console.log("Successfully convert batch", tx.hash);
}

module.exports.start = async (account) => {
    try {
        console.log("Start converting protocol fee V2");
        const pairlist = await PairListAPI.get(chainId);

        const smora = Interaction.getContract(smoraAddress, sMoraABI, account);
        const makerv2 = Interaction.getContract(makerv2Address, MakerV2ABI, account);

        let batches = []
        let pairs = []
        let token0s = []
        let token1s = []
        let maxBatchItem = 2
        for (let i = 0; i < pairlist.length; i++) {
            const pair = pairlist[i];
            if (pair.address) {
                const erc20 = Interaction.getContract(pair.address, Erc20ABI, account);
                console.log("Checking balance of pair", pair.address);
                const lpBalance = await erc20.balanceOf(makerv2.address);
                console.log("Balance:", lpBalance);
                if (lpBalance.gt(_0)) {
                    pairs.push(pair.address);
                    token0s.push(pair.token0.address);
                    token1s.push(pair.token1.address);

                    if (token0s.length === maxBatchItem || i === pairlist.length - 1) {
                        batches.push({
                            pairs: pairs,
                            token0s: token0s,
                            token1s: token1s
                        });

                        pairs = [];
                        token0s = [];
                        token1s = [];
                    }
                }
            }
        }
        // console.log("Batches:", batches);
        for (let i = 0; i < batches.length; i++) {
            await convertMultiple(makerv2, batches[i]);
        }

        console.log("Start updating reward");
        const tx = await smora.updateReward(rewardAddress);
        console.log("Waiting for confirmations", tx.hash);
        await tx.wait();
    }
    catch (e) {
        console.log(e);
    }
};