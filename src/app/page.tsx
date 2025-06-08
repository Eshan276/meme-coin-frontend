"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect, useRef } from "react";
import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import WalletButton from "@/components/WalletButton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";

// Import your IDL
import idlJson from "@/idl/meme_coin_program.json";

// Make sure PROGRAM_ID is properly constructed
const PROGRAM_ID_STRING = "5ZCsDZAV9oH7Souj6UWtX3Q94ZrmPkVF5MVQuzmDd66X";
let PROGRAM_ID: PublicKey;

try {
  PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);
  console.log("PROGRAM_ID created successfully:", PROGRAM_ID.toString());
} catch (error) {
  console.error("Error creating PROGRAM_ID:", error);
  throw error;
}

// Fix the IDL by updating the program ID in metadata
const idl = {
  ...idlJson,
  address: PROGRAM_ID_STRING,
  metadata: {
    ...((idlJson as any).metadata || {}),
    address: PROGRAM_ID_STRING,
  },
};

// Mock chart data
const generateChartData = (coin) => {
  const basePrice = coin?.priceInSOL || 0.001;
  return Array.from({ length: 24 }, (_, i) => ({
    time: i,
    price: basePrice * (1 + (Math.random() - 0.5) * 0.1),
    volume: Math.random() * 1000,
  }));
};

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const chartRef = useRef(null);

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("trade");
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    symbol: "",
    uri: "",
    decimals: 9,
    initialSupply: 1000000,
    pricePerToken: 1000000,
  });
  const [buyForm, setBuyForm] = useState({ coinName: "", amount: 1 });
  const [sellForm, setSellForm] = useState({ coinName: "", amount: 1 });
  const [coins, setCoins] = useState<any[]>([]);
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && wallet.connected && wallet.publicKey) {
      console.log("Wallet connected, loading data...");
      loadUserData();
    } else if (!wallet.connected) {
      setCoins([]);
      setUserTokens([]);
      setSolBalance(0);
    }
  }, [mounted, wallet.connected, wallet.publicKey]);

  const loadUserData = async () => {
    if (!wallet.publicKey) return;

    try {
      setLoading(true);
      const balance = await connection.getBalance(wallet.publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);
      await Promise.all([loadUserTokens(), loadAvailableCoins()]);
    } catch (error) {
      console.error("Error loading user data:", error);
      setStatus(
        `Error loading user data: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableCoins = async () => {
    try {
      console.log("=== Loading Available Coins ===");
      const program = getProgram();
      if (!program) {
        console.log("No program available");
        setStatus("Program not initialized");
        return;
      }

      console.log("Fetching all meme coin accounts...");
      const memeCoinAccounts: { publicKey: PublicKey; account: any }[] =
        await program.account.memeCoin.all();

      const coinsData = memeCoinAccounts.map((account) => {
        console.log(
          "Processing account:",
          account.publicKey.toString(),
          account.account
        );

        return {
          address: account.publicKey,
          ...(account.account as Record<string, unknown>),
          priceInSOL: account.account.pricePerToken / LAMPORTS_PER_SOL,
          chartData: generateChartData(account.account),
        };
      });

      console.log("Processed coins data:", coinsData);
      setCoins(coinsData);
      if (coinsData.length > 0 && !selectedCoin) {
        setSelectedCoin(coinsData[0]);
      }
    } catch (error) {
      console.error("Error loading meme coins:", error);
      setStatus(
        `Error loading coins: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setCoins([]);
    }
  };

  const loadUserTokens = async () => {
    if (!wallet.publicKey) return;

    try {
      const { getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } =
        await import("@solana/spl-token");
      const program = getProgram();
      if (!program) return;

      const memeCoinAccounts = await program.account.memeCoin.all();
      const userTokensData = [];

      for (const memeCoinAccount of memeCoinAccounts) {
        try {
          const userTokenAccount = await getAssociatedTokenAddress(
            memeCoinAccount.account.mint,
            wallet.publicKey
          );
          const accountInfo = await connection.getAccountInfo(userTokenAccount);

          if (accountInfo) {
            const tokenAccount = await getAccount(connection, userTokenAccount);
            if (Number(tokenAccount.amount) > 0) {
              userTokensData.push({
                mint: memeCoinAccount.account.mint.toString(),
                name: memeCoinAccount.account.name,
                symbol: memeCoinAccount.account.symbol,
                balance: Number(tokenAccount.amount),
                decimals: memeCoinAccount.account.decimals,
                pricePerToken: Number(memeCoinAccount.account.pricePerToken),
                tokenAccount: userTokenAccount,
              });
            }
          }
        } catch (error) {
          console.log(`No token account for ${memeCoinAccount.account.name}`);
        }
      }

      setUserTokens(userTokensData);
      console.log("User tokens:", userTokensData);
    } catch (error) {
      console.error("Error loading user tokens:", error);
      setStatus(
        `Error loading tokens: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const getProgram = () => {
    if (!wallet.wallet?.adapter) {
      console.error("Wallet adapter is not initialized");
      return null;
    }

    const provider = new anchor.AnchorProvider(
      connection,
      wallet as any,
      anchor.AnchorProvider.defaultOptions()
    );

    try {
      const program = new anchor.Program(idl as any, PROGRAM_ID, provider);
      return program;
    } catch (error) {
      console.error("Error initializing program:", error);
      return null;
    }
  };

  const createMemeCoin = async () => {
    if (!wallet.publicKey) {
      setStatus("Please connect your wallet first");
      return;
    }

    if (!createForm.name || !createForm.symbol || !createForm.uri) {
      setStatus("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setStatus("Creating meme coin...");

    try {
      const program = getProgram();
      if (!program) throw new Error("Program not initialized");

      const mint = anchor.web3.Keypair.generate();
      const [memeCoinPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("meme_coin"), Buffer.from(createForm.name)],
        PROGRAM_ID
      );

      const balance = await connection.getBalance(wallet.publicKey);
      if (balance < 0.1 * LAMPORTS_PER_SOL) {
        throw new Error(
          "Insufficient SOL balance. Need at least 0.1 SOL for transaction fees."
        );
      }

      const { blockhash } = await connection.getLatestBlockhash("confirmed");

      const accounts = {
        memeCoin: memeCoinPda,
        mint: mint.publicKey,
        creator: wallet.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      const instruction = await program.methods
        .createMemeCoin(
          createForm.name,
          createForm.symbol,
          createForm.uri,
          createForm.decimals,
          new anchor.BN(createForm.initialSupply),
          new anchor.BN(createForm.pricePerToken)
        )
        .accounts(accounts)
        .signers([mint])
        .instruction();

      const transaction = new anchor.web3.Transaction().add(instruction);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      transaction.partialSign(mint);
      const signedTx = await wallet.signTransaction!(transaction);

      const tx = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      const confirmation = await connection.confirmTransaction(
        {
          signature: tx,
          blockhash: blockhash,
          lastValidBlockHeight: (
            await connection.getLatestBlockhash()
          ).lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
        );
      }

      setStatus(`✅ Meme coin created successfully! TX: ${tx}`);
      setCreateForm({
        name: "",
        symbol: "",
        uri: "",
        decimals: 9,
        initialSupply: 1000000,
        pricePerToken: 1000000,
      });

      await loadUserData();
    } catch (error) {
      console.error("Error creating meme coin:", error);
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setLoading(false);
    }
  };

  const ensureAssociatedTokenAccount = async (
    mint: PublicKey,
    owner: PublicKey
  ) => {
    const {
      getAssociatedTokenAddress,
      createAssociatedTokenAccountInstruction,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    } = await import("@solana/spl-token");
    const ata = await getAssociatedTokenAddress(mint, owner);
    const ataInfo = await connection.getAccountInfo(ata);

    if (!ataInfo) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          owner,
          ata,
          owner,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = owner;

      const signedTx = await wallet.signTransaction!(transaction);
      const tx = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(
        {
          signature: tx,
          blockhash: blockhash,
          lastValidBlockHeight: (
            await connection.getLatestBlockhash()
          ).lastValidBlockHeight,
        },
        "confirmed"
      );
    }

    return ata;
  };

  const buyMemeCoin = async (coinName, amount) => {
    if (!wallet.publicKey) {
      setStatus("Please connect your wallet first");
      return;
    }

    if (!coinName || amount <= 0) {
      setStatus("Please enter valid coin name and amount");
      return;
    }

    setLoading(true);
    setStatus(`Buying ${amount} ${coinName} tokens...`);

    try {
      const program = getProgram();
      if (!program) throw new Error("Program not initialized");

      const formattedCoinName = coinName.trim();
      const [memeCoinPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("meme_coin"), Buffer.from(formattedCoinName)],
        PROGRAM_ID
      );

      const memeCoinAccount = await program.account.memeCoin.fetch(memeCoinPda);
      if (!memeCoinAccount.isActive) throw new Error("Coin is not active");

      const mint = memeCoinAccount.mint;
      const pricePerToken = Number(memeCoinAccount.pricePerToken);
      const totalCost = (amount * pricePerToken) / LAMPORTS_PER_SOL;

      const balance = await connection.getBalance(wallet.publicKey);
      if (balance < totalCost * LAMPORTS_PER_SOL + 0.01 * LAMPORTS_PER_SOL) {
        throw new Error(
          `Insufficient SOL balance. Need at least ${(totalCost + 0.01).toFixed(
            4
          )} SOL for purchase and fees.`
        );
      }

      const buyerTokenAccount = await ensureAssociatedTokenAccount(
        mint,
        wallet.publicKey
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 2000000,
        })
      );

      const { ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");

      const buyInstruction = await program.methods
        .buyMemeCoin(new anchor.BN(amount))
        .accounts({
          memeCoin: memeCoinPda,
          mint: mint,
          buyer: wallet.publicKey,
          creator: memeCoinAccount.creator,
          buyerTokenAccount: buyerTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

      transaction.add(buyInstruction);

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTx = await wallet.signTransaction!(transaction);
      const tx = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      const confirmation = await connection.confirmTransaction(
        {
          signature: tx,
          blockhash: blockhash,
          lastValidBlockHeight: (
            await connection.getLatestBlockhash()
          ).lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
        );
      }

      setStatus(
        `✅ Successfully bought ${amount} ${coinName} tokens! TX: ${tx}`
      );
      setBuyForm({ coinName: "", amount: 1 });
      await loadUserData();
    } catch (error) {
      console.error("Transaction error:", error);
      let errorMessage = `❌ Error buying ${coinName}: ${
        error.message || String(error)
      }`;
      setStatus(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sellMemeCoin = async (coinName, amount) => {
    if (!wallet.publicKey) {
      setStatus("Please connect your wallet first");
      return;
    }

    if (!coinName || amount <= 0) {
      setStatus("Please enter valid coin name and amount");
      return;
    }

    setLoading(true);
    setStatus(`Selling ${amount} ${coinName} tokens...`);

    try {
      const program = getProgram();
      if (!program) throw new Error("Program not initialized");

      const formattedCoinName = coinName.trim();
      const [memeCoinPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("meme_coin"), Buffer.from(formattedCoinName)],
        PROGRAM_ID
      );

      const memeCoinAccount = await program.account.memeCoin.fetch(memeCoinPda);
      if (!memeCoinAccount.isActive) throw new Error("Coin is not active");

      const mint = memeCoinAccount.mint;
      const { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } =
        await import("@solana/spl-token");
      const sellerTokenAccount = await getAssociatedTokenAddress(
        mint,
        wallet.publicKey
      );

      const tokenAccountInfo = await getAccount(connection, sellerTokenAccount);
      if (Number(tokenAccountInfo.amount) < amount) {
        throw new Error(
          `Insufficient token balance. Available: ${tokenAccountInfo.amount}`
        );
      }

      const tx = await program.methods
        .sellMemeCoin(new anchor.BN(amount))
        .accounts({
          memeCoin: memeCoinPda,
          mint: mint,
          seller: wallet.publicKey,
          creator: memeCoinAccount.creator,
          sellerTokenAccount: sellerTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ skipPreflight: false, commitment: "confirmed" });

      setStatus(`✅ Successfully sold ${amount} ${coinName} tokens! TX: ${tx}`);
      setSellForm({ coinName: "", amount: 1 });
      await loadUserData();
    } catch (error) {
      console.error("Error selling meme coin:", error);
      setStatus(
        `❌ Error selling ${coinName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Quantum DEX
          </h1>
          <p className="text-gray-400 mt-2">
            Initializing quantum protocols...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-700"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4 animate-pulse">
            ⚡ QUANTUM DEX
          </h1>
          <p className="text-xl text-gray-300 mb-6">
            Next-Generation Meme Coin Trading Protocol
          </p>
          <div className="flex justify-center">
            <WalletButton />
          </div>

          {wallet.connected && (
            <div className="mt-6 inline-block bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-300">SOL Balance:</span>
                <span className="text-2xl font-bold text-green-400">
                  {solBalance.toFixed(4)}
                </span>
                <span className="text-sm text-gray-400 font-mono">
                  {wallet.publicKey?.toString().slice(0, 6)}...
                  {wallet.publicKey?.toString().slice(-4)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Status Display */}
        {status && (
          <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-xl border border-blue-400/20 rounded-2xl p-4 text-center">
            <p className="text-blue-200">{status}</p>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex space-x-2">
            {["trade", "create", "portfolio"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  activeTab === tab
                    ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/25"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Trading Interface */}
        {activeTab === "trade" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Section */}
            <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {selectedCoin?.name || "Select a Coin"}
                  </h3>
                  <p className="text-gray-400">{selectedCoin?.symbol || ""}</p>
                </div>
                {selectedCoin && (
                  <div className="text-right">
                    <p className="text-3xl font-bold text-green-400">
                      ${selectedCoin.priceInSOL?.toFixed(6)}
                    </p>
                    <p className="text-sm text-gray-400">+2.45% (24h)</p>
                  </div>
                )}
              </div>

              {/* Chart */}
              <div className="h-80 mb-6">
                {selectedCoin?.chartData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedCoin.chartData}>
                      <defs>
                        <linearGradient
                          id="colorPrice"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#06b6d4"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#06b6d4"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(0, 0, 0, 0.8)",
                          border: "none",
                          borderRadius: "12px",
                          color: "white",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-gray-600 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4"></div>
                      <p>Select a coin to view chart</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              {selectedCoin && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 text-center">
                    <p className="text-gray-400 text-sm">Volume</p>
                    <p className="text-white font-bold">
                      {(selectedCoin.totalVolume / LAMPORTS_PER_SOL).toFixed(2)}{" "}
                      SOL
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 text-center">
                    <p className="text-gray-400 text-sm">Holders</p>
                    <p className="text-white font-bold">
                      {selectedCoin.holdersCount}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 text-center">
                    <p className="text-gray-400 text-sm">Supply</p>
                    <p className="text-white font-bold">
                      {selectedCoin.totalSupply?.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 text-center">
                    <p className="text-gray-400 text-sm">Circulating</p>
                    <p className="text-white font-bold">
                      {selectedCoin.circulatingSupply || 0}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Trading Panel */}
            <div className="space-y-6">
              {/* Buy/Sell Toggle */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                <div className="flex bg-white/5 rounded-2xl p-1 mb-6">
                  <button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold">
                    Buy
                  </button>
                  <button className="flex-1 py-3 rounded-xl text-gray-400 hover:text-white transition-colors">
                    Sell
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Token
                    </label>
                    <input
                      type="text"
                      value={buyForm.coinName}
                      onChange={(e) =>
                        setBuyForm({ ...buyForm, coinName: e.target.value })
                      }
                      placeholder="Enter token name"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Amount
                    </label>
                    <input
                      type="number"
                      value={buyForm.amount}
                      onChange={(e) =>
                        setBuyForm({
                          ...buyForm,
                          amount: parseInt(e.target.value),
                        })
                      }
                      placeholder="0"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    />
                  </div>

                  <button
                    onClick={() =>
                      buyMemeCoin(buyForm.coinName, buyForm.amount)
                    }
                    disabled={loading || !wallet.connected}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-lg shadow-green-500/25"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Buying...
                      </div>
                    ) : (
                      "⚡ Execute Buy"
                    )}
                  </button>
                </div>
              </div>

              {/* Market List */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  🔥 Trending Markets
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                  {coins.map((coin, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedCoin(coin)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                        selectedCoin?.name === coin.name
                          ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30"
                          : "bg-white/5 hover:bg-white/10 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {coin.symbol?.charAt(0) || "?"}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-semibold">
                              {coin.name}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {coin.symbol}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold">
                            ${coin.priceInSOL?.toFixed(6)}
                          </p>
                          <p className="text-green-400 text-sm">
                            +{(Math.random() * 10) | 0}.
                            {(Math.random() * 99) | 0}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Token Interface */}
        {activeTab === "create" && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  🚀 Launch Your Token
                </h2>
                <p className="text-gray-400">
                  Deploy your meme coin to the quantum realm
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Token Name
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, name: e.target.value })
                      }
                      placeholder="Quantum Doge"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Symbol
                    </label>
                    <input
                      type="text"
                      value={createForm.symbol}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, symbol: e.target.value })
                      }
                      placeholder="QDOGE"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Metadata URI
                    </label>
                    <input
                      type="text"
                      value={createForm.uri}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, uri: e.target.value })
                      }
                      placeholder="https://your-metadata.json"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Total Supply
                    </label>
                    <input
                      type="number"
                      value={createForm.initialSupply}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          initialSupply: parseInt(e.target.value),
                        })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Price per Token (
                      {(createForm.pricePerToken / LAMPORTS_PER_SOL).toFixed(6)}{" "}
                      SOL)
                    </label>
                    <input
                      type="number"
                      value={createForm.pricePerToken}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          pricePerToken: parseInt(e.target.value),
                        })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-400/20 rounded-2xl p-4">
                    <h4 className="text-cyan-400 font-semibold mb-2">
                      💰 Creator Economics
                    </h4>
                    <div className="space-y-1 text-sm text-gray-300">
                      <p>• You earn SOL on every trade</p>
                      <p>• 5% fee on sells goes to treasury</p>
                      <p>• Tokens minted on demand</p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={createMemeCoin}
                disabled={loading || !wallet.connected}
                className="w-full mt-8 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-lg shadow-cyan-500/25"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Deploying to Quantum Realm...
                  </div>
                ) : (
                  "🚀 Launch Token"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Portfolio Interface */}
        {activeTab === "portfolio" && (
          <div className="space-y-6">
            {/* Portfolio Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-400/20 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-green-400 font-semibold">
                    Total Portfolio Value
                  </h3>
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                </div>
                <p className="text-3xl font-bold text-white">
                  {userTokens
                    .reduce(
                      (total, token) =>
                        total +
                        (token.balance * token.pricePerToken) /
                          LAMPORTS_PER_SOL,
                      0
                    )
                    .toFixed(4)}{" "}
                  SOL
                </p>
                <p className="text-green-400 text-sm mt-1">+12.45% (24h)</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-400/20 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-blue-400 font-semibold">
                    Active Positions
                  </h3>
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                </div>
                <p className="text-3xl font-bold text-white">
                  {userTokens.length}
                </p>
                <p className="text-blue-400 text-sm mt-1">Different tokens</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-400/20 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-purple-400 font-semibold">SOL Balance</h3>
                  <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                </div>
                <p className="text-3xl font-bold text-white">
                  {solBalance.toFixed(4)}
                </p>
                <p className="text-purple-400 text-sm mt-1">
                  Available to trade
                </p>
              </div>
            </div>

            {/* Holdings */}
            {userTokens.length > 0 ? (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                <h3 className="text-2xl font-bold text-white mb-6">
                  💎 Your Holdings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {userTokens.map((token, index) => (
                    <div
                      key={index}
                      className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 group"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">
                              {token.symbol?.charAt(0) || "?"}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-white font-semibold">
                              {token.name}
                            </h4>
                            <p className="text-gray-400 text-sm">
                              {token.symbol}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold">
                            {token.balance}
                          </p>
                          <p className="text-gray-400 text-sm">tokens</p>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Price:</span>
                          <span className="text-yellow-400">
                            {(token.pricePerToken / LAMPORTS_PER_SOL).toFixed(
                              6
                            )}{" "}
                            SOL
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Value:</span>
                          <span className="text-green-400 font-semibold">
                            {(
                              (token.balance * token.pricePerToken) /
                              LAMPORTS_PER_SOL
                            ).toFixed(6)}{" "}
                            SOL
                          </span>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => buyMemeCoin(token.name.trim(), 1)}
                          disabled={loading || !wallet.connected}
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-2 rounded-xl transition-all duration-300 transform group-hover:scale-105"
                        >
                          Buy
                        </button>
                        <button
                          onClick={() =>
                            sellMemeCoin(
                              token.name.trim(),
                              Math.min(10, token.balance)
                            )
                          }
                          disabled={loading || !wallet.connected}
                          className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-2 rounded-xl transition-all duration-300 transform group-hover:scale-105"
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">💼</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  No Holdings Yet
                </h3>
                <p className="text-gray-400 mb-6">
                  Start trading to build your quantum portfolio
                </p>
                <button
                  onClick={() => setActiveTab("trade")}
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold px-8 py-3 rounded-2xl transition-all duration-300 transform hover:scale-105"
                >
                  Start Trading
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-400/20 rounded-2xl p-4 inline-block">
            <p className="text-yellow-200 font-semibold">
              ⚡ Quantum DEX v2.0 - Powered by Solana Devnet
            </p>
            <p className="text-yellow-400/70 text-sm mt-1">
              Program ID: {PROGRAM_ID.toString().slice(0, 8)}...
              {PROGRAM_ID.toString().slice(-8)}
            </p>
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.7);
        }
      `}</style>
    </div>
  );
}
