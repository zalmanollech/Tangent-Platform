import { useState, useCallback } from 'react';
import { ethers } from 'ethers';

// Contract addresses (Sepolia)
const TGT_ADDRESS = '0xe91899Be4C9BDa5816DB885966a29cf90732bb9B';
const ESCROW_ADDRESS = '0xdCFC79c81901903D59eEb4d548661C8CD0c98f87';

// Contract ABIs
const TGT_ABI = [
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
  "function mint(address to, uint256 amount) external",
  "function burn(uint256 amount) external"
];

const ESCROW_ABI = [
  "function createTrade(address supplier, address buyer, uint256 p1, uint16 depositPct, uint16 financePct) external returns (uint256)",
  "function buyerDeposit(uint256 id, uint256 amount) external",
  "function acceptDocsAndIssueKey(uint256 id, bytes32 keyHash, uint64 finalDeadline) external",
  "function payFinal(uint256 id, uint256 amount) external",
  "function claimDocs(uint256 id, string calldata keyPlain) external",
  "function markDefault(uint256 id) external",
  "function trades(uint256) view returns (address,address,address,uint256,uint16,uint16,uint256,uint256,bytes32,uint64,uint8)",
  "function nextTradeId() view returns (uint256)"
];

export function useTransactions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const getProvider = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask not found');
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  const getSigner = useCallback(async () => {
    const provider = await getProvider();
    return provider.getSigner();
  }, [getProvider]);

  const getContracts = useCallback(async () => {
    const signer = await getSigner();
    const tgt = new ethers.Contract(TGT_ADDRESS, TGT_ABI, signer);
    const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
    return { tgt, escrow, signer };
  }, [getSigner]);

  const executeTransaction = useCallback(async (txFunction, description) => {
    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      console.log(`Executing: ${description}`);
      const tx = await txFunction();
      setTxHash(tx.hash);
      console.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed: ${receipt.hash}`);
      return receipt;
    } catch (err) {
      const errorMsg = err.message || 'Transaction failed';
      setError(errorMsg);
      console.error(`Transaction failed: ${errorMsg}`, err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // TGT Token Operations
  const approveTGT = useCallback(async (spender, amount) => {
    const { tgt } = await getContracts();
    return executeTransaction(
      () => tgt.approve(spender, amount),
      `Approve ${amount} TGT for ${spender}`
    );
  }, [getContracts, executeTransaction]);

  const getTGTBalance = useCallback(async (address) => {
    const { tgt } = await getContracts();
    return await tgt.balanceOf(address);
  }, [getContracts]);

  const getTGTAllowance = useCallback(async (owner, spender) => {
    const { tgt } = await getContracts();
    return await tgt.allowance(owner, spender);
  }, [getContracts]);

  // Escrow Operations
  const createTrade = useCallback(async (supplier, buyer, p1, depositPct = 30, financePct = 70) => {
    const { escrow } = await getContracts();
    return executeTransaction(
      () => escrow.createTrade(supplier, buyer, p1, depositPct, financePct),
      `Create trade: ${supplier} -> ${buyer}, amount: ${p1}`
    );
  }, [getContracts, executeTransaction]);

  const buyerDeposit = useCallback(async (tradeId, amount) => {
    const { escrow } = await getContracts();
    return executeTransaction(
      () => escrow.buyerDeposit(tradeId, amount),
      `Buyer deposit ${amount} for trade ${tradeId}`
    );
  }, [getContracts, executeTransaction]);

  const acceptDocsAndIssueKey = useCallback(async (tradeId, keyHash, finalDeadline) => {
    const { escrow } = await getContracts();
    return executeTransaction(
      () => escrow.acceptDocsAndIssueKey(tradeId, keyHash, finalDeadline),
      `Accept docs and issue key for trade ${tradeId}`
    );
  }, [getContracts, executeTransaction]);

  const payFinal = useCallback(async (tradeId, amount) => {
    const { escrow } = await getContracts();
    return executeTransaction(
      () => escrow.payFinal(tradeId, amount),
      `Pay final ${amount} for trade ${tradeId}`
    );
  }, [getContracts, executeTransaction]);

  const claimDocs = useCallback(async (tradeId, keyPlain) => {
    const { escrow } = await getContracts();
    return executeTransaction(
      () => escrow.claimDocs(tradeId, keyPlain),
      `Claim docs for trade ${tradeId}`
    );
  }, [getContracts, executeTransaction]);

  // Utility functions
  const formatUnits = useCallback((value, decimals = 18) => {
    return ethers.formatUnits(value, decimals);
  }, []);

  const parseUnits = useCallback((value, decimals = 18) => {
    return ethers.parseUnits(value, decimals);
  }, []);

  const hashString = useCallback((str) => {
    return ethers.keccak256(ethers.toUtf8Bytes(str));
  }, []);

  return {
    loading,
    error,
    txHash,
    // TGT operations
    approveTGT,
    getTGTBalance,
    getTGTAllowance,
    // Escrow operations
    createTrade,
    buyerDeposit,
    acceptDocsAndIssueKey,
    payFinal,
    claimDocs,
    // Utilities
    formatUnits,
    parseUnits,
    hashString,
    // Contract addresses
    TGT_ADDRESS,
    ESCROW_ADDRESS
  };
}
