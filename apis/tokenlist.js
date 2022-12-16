#!/usr/bin/env node
"use strict";

const { default: axios } = require('axios');

module.exports.get = async (chainId) => {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/moraswap/tokens/master/tokenlist.json');
        if (response?.status && response?.data) {
            const parsedData = response?.data
            const result = parsedData.tokens.filter(item => item.chainId === chainId);
            return result;
        }
        else {
            console.log(response);
        }
    }
    catch (e) {
        console.log(e);
    }

    return [];
};