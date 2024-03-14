#!/usr/bin/env node
"use strict";

const Config = require("../config");
const PoolListAPI = require("../apis/poollist");
const TokenListAPI = require("../apis/tokenlist");
const Interaction = require("../interaction");
const Erc20ABI = require("../abis/erc20.json");
const V3PoolABI = require("../abis/v3pool.json");
const MakerV2ABI = require("../abis/makerv2.json");
const { BigNumber } = require("ethers");

const _0 = BigNumber.from("0");
const _1 = BigNumber.from("1");
const chainId = Config.getConfig().chainId;
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

async function v3CollectFee(poolAddress, account) {
    console.log("Start collecting fee pool", poolAddress);
    const pool = Interaction.getContract(poolAddress, V3PoolABI, account);
    const protocolFees = await pool.protocolFees();
    // console.log(protocolFees);
    const fees0 = BigNumber.from(protocolFees["token0"].toString());
    const fees1 = BigNumber.from(protocolFees["token1"].toString());
    if (fees0.gt(_1) || fees1.gt(_1)) {
        const tx = await pool.collectProtocol(makerv2Address, fees0, fees1);
        console.log("Waiting for confirmations", tx.hash);
        await tx.wait();
        // await timeout(1000);
        console.log("Collected fee successfully", tx.hash);
    }
    else {
        console.log("Nothing to collect");
    }
    return {
        fees0,
        fees1
    }
}

module.exports.start = async (account) => {
    try {
        console.log("Start converting protocol fee V3");
        // collect v3 fees
        const poollist = await PoolListAPI.get(chainId);
        const tokenlist = await TokenListAPI.get(chainId);
        let feelist = tokenlist.map(token => ({
            ...token,
            fee: _0
        }))
        for (let i = 0; i < poollist.length; i++) {
            const protocolFees = await v3CollectFee(poollist[i].address, account);
            const fees0Index = feelist.findIndex(item => item.address.toLowerCase() === poollist[i].token0.address.toLowerCase());
            if (fees0Index >= 0) {
                feelist[fees0Index].fee = feelist[fees0Index].fee.add(protocolFees.fees0);
            }
            const fees1Index = feelist.findIndex(item => item.address.toLowerCase() === poollist[i].token1.address.toLowerCase());
            if (fees1Index >= 0) {
                feelist[fees1Index].fee = feelist[fees1Index].fee.add(protocolFees.fees1);
            }
            console.log("Total collected fee " + poollist[i].token0.symbol + ":", feelist[fees0Index].fee.toString());
            console.log("Total collected fee " + poollist[i].token1.symbol + ":", feelist[fees1Index].fee.toString());
        }

        // Convert collected fee to reward
        const makerv2 = Interaction.getContract(makerv2Address, MakerV2ABI, account);

        let batches = []
        let pairs = []
        let token0s = []
        let token1s = []
        let maxBatchItem = 2
        for (let i = 0; i < tokenlist.length; i++) {
            const token = tokenlist[i];
            if (token.address) {
                const erc20 = Interaction.getContract(token.address, Erc20ABI, account);
                console.log("Checking balance of token", token.address);
                const lpBalance = await erc20.balanceOf(makerv2.address);
                console.log("Balance:", lpBalance);
                if (lpBalance.gt(_0)) {
                    pairs.push(token.address);
                    token0s.push(token.address);
                    token1s.push(token.address);

                    if (token0s.length === maxBatchItem || i === tokenlist.length - 1) {
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
    }
    catch (e) {
        console.log(e);
    }
};