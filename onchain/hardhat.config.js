// onchain/hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");

const { SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

// Normalize PK: ensure it starts with 0x if present
const pk = SEPOLIA_PRIVATE_KEY
  ? SEPOLIA_PRIVATE_KEY.startsWith("0x")
    ? SEPOLIA_PRIVATE_KEY
    : `0x${SEPOLIA_PRIVATE_KEY}`
  : undefined;

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: SEPOLIA_RPC_URL || "", // must be a non-empty string
      accounts: pk ? [pk] : [], // must be a non-empty array with a valid 0x… key
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY || "",
  },
};
