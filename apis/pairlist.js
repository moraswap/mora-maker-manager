#!/usr/bin/env node
"use strict";

const fullList = require("./pairlist.json");

module.exports.get = async (chainId) => {
    try {
        const result = fullList.filter(item => item.chainId === chainId);
            return result;
    }
    catch (e) {
        console.log(e);
    }

    return [];
};