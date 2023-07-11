#!/usr/bin/env node
"use strict";

const { default: axios } = require('axios');

module.exports.get = async (token = "solana") => {
    try {
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`);
        if (response?.status && response?.data) {
            const parsedData = response?.data;
            const result = parsedData[token].usd;
            return result;
        }
        else {
            console.log(response);
        }
    }
    catch (e) {
        console.log(e);
    }

    return 0;
};