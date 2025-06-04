"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import WalletButton from "@/components/WalletButton";

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

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [mounted, setMounted] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    symbol: "",
    uri: "",
    decimals: 9,
    initialSupply: 1000000,
    pricePerToken: 1000000, // 0.001 SOL in lamports
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
      const memeCoinAccounts = await program.account.memeCoin.all();
      console.log("Found meme coin accounts:", memeCoinAccounts.length);

      const coinsData = memeCoinAccounts.map((account) => {
        console.log(
          "Processing account:",
          account.publicKey.toString(),
          account.account
        );
        return {
          address: account.publicKey,
          ...account.account,
          priceInSOL: account.account.pricePerToken / LAMPORTS_PER_SOL,
        };
      });

      console.log("Processed coins data:", coinsData);
      setCoins(coinsData);
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

    console.log("=== Program ID Debug ===");
    console.log("PROGRAM_ID we're using:", PROGRAM_ID.toString());
    console.log("IDL original metadata:", (idlJson as any).metadata);
    console.log("IDL corrected metadata:", idl.metadata);
    console.log("========================");

    try {
      const program = new anchor.Program(idl as any, PROGRAM_ID, provider);
      console.log("Program initialized successfully");
      console.log(
        "Program ID from program object:",
        program.programId.toString()
      );
      console.log("Are they equal?", program.programId.equals(PROGRAM_ID));
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
      console.log("=== Starting Meme Coin Creation ===");
      console.log("Form data:", createForm);
      console.log("Wallet public key:", wallet.publicKey.toString());
      console.log("Connection endpoint:", connection.rpcEndpoint);

      const program = getProgram();
      if (!program) throw new Error("Program not initialized");

      const mint = anchor.web3.Keypair.generate();
      console.log("Generated mint:", mint.publicKey.toString());

      const [memeCoinPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("meme_coin"), Buffer.from(createForm.name)],
        PROGRAM_ID
      );
      console.log("PDA found:", memeCoinPda.toString(), "bump:", bump);

      const balance = await connection.getBalance(wallet.publicKey);
      console.log("Wallet balance:", balance / LAMPORTS_PER_SOL, "SOL");

      if (balance < 0.1 * LAMPORTS_PER_SOL) {
        throw new Error(
          "Insufficient SOL balance. Need at least 0.1 SOL for transaction fees."
        );
      }

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      console.log("Got blockhash:", blockhash);

      const accounts = {
        memeCoin: memeCoinPda,
        mint: mint.publicKey,
        creator: wallet.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      console.log("Accounts:", accounts);
      console.log("Signers:", [mint.publicKey.toString()]);

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

      console.log("Instruction built successfully");

      const transaction = new anchor.web3.Transaction().add(instruction);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log("Signing transaction...");
      transaction.partialSign(mint);
      const signedTx = await wallet.signTransaction!(transaction);

      console.log("Sending transaction...");
      const tx = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      console.log("Transaction sent:", tx);
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

      console.log("Transaction confirmed:", tx);
      setStatus(`✅ Meme coin created successfully! TX: ${tx}`);
      console.log("Success! Transaction:", tx);

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
      console.log("=== Meme Coin Creation Complete ===");
    }
  };

  const buyMemeCoin = async (coinName: string, amount: number) => {
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

      const [memeCoinPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("meme_coin"), Buffer.from(coinName)],
        PROGRAM_ID
      );

      const memeCoinAccount = await program.account.memeCoin.fetch(memeCoinPda);
      if (!memeCoinAccount.isActive) throw new Error("Coin is not active");

      const mint = memeCoinAccount.mint;
      const pricePerToken = Number(memeCoinAccount.pricePerToken);
      const totalCost = (amount * pricePerToken) / LAMPORTS_PER_SOL;

      const balance = await connection.getBalance(wallet.publicKey);
      if (balance < totalCost * LAMPORTS_PER_SOL) {
        throw new Error(
          `Insufficient SOL balance. Need at least ${totalCost.toFixed(4)} SOL.`
        );
      }

      const {
        getAssociatedTokenAddress,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      } = await import("@solana/spl-token");

      const buyerTokenAccount = await getAssociatedTokenAddress(
        mint,
        wallet.publicKey
      );

      console.log("=== Buying Meme Coin ===");
      console.log(
        "Coin:",
        coinName,
        "Amount:",
        amount,
        "PDA:",
        memeCoinPda.toString()
      );

      const tx = await program.methods
        .buyMemeCoin(new anchor.BN(amount))
        .accounts({
          memeCoin: memeCoinPda,
          mint: mint,
          buyer: wallet.publicKey,
          creator: memeCoinAccount.creator,
          buyerTokenAccount: buyerTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc({ skipPreflight: false, commitment: "confirmed" });

      console.log("Buy transaction confirmed:", tx);
      setStatus(
        `✅ Successfully bought ${amount} ${coinName} tokens! TX: ${tx}`
      );
      setBuyForm({ coinName: "", amount: 1 });
      await loadUserData();
    } catch (error) {
      console.error("Error buying meme coin:", error);
      setStatus(
        `❌ Error buying ${coinName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const sellMemeCoin = async (coinName: string, amount: number) => {
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

      const [memeCoinPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("meme_coin"), Buffer.from(coinName)],
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

      console.log("=== Selling Meme Coin ===");
      console.log(
        "Coin:",
        coinName,
        "Amount:",
        amount,
        "PDA:",
        memeCoinPda.toString()
      );

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

      console.log("Sell transaction confirmed:", tx);
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
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            🚀 Meme Coin Factory
          </h1>
          <p className="text-xl text-gray-300">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🚀 Meme Coin Factory
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Create, buy, and sell meme coins on Solana Devnet
          </p>
          <WalletButton />
          {wallet.connected && (
            <div className="mt-6 bg-white/10 backdrop-blur-md rounded-lg p-4 inline-block">
              <p className="text-white font-medium">
                💰 SOL Balance:{" "}
                <span className="text-green-400">
                  {solBalance.toFixed(4)} SOL
                </span>
              </p>
              <p className="text-gray-300 text-sm">
                Wallet: {wallet.publicKey?.toString().slice(0, 8)}...
                {wallet.publicKey?.toString().slice(-8)}
              </p>
            </div>
          )}
        </div>

        {status && (
          <div className="bg-blue-800/50 border border-blue-400 rounded-lg p-4 mb-8 text-center">
            <p className="text-white">{status}</p>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 mb-8 border border-white/20">
          <h2 className="text-3xl font-bold text-white mb-6">
            Create New Meme Coin
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-white font-medium mb-2">
                Coin Name
              </label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="Doge to the Moon"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white font-medium mb-2">
                Symbol
              </label>
              <input
                type="text"
                value={createForm.symbol}
                onChange={(e) =>
                  setCreateForm({ ...createForm, symbol: e.target.value })
                }
                placeholder="MOON"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white font-medium mb-2">
                Metadata URI
              </label>
              <input
                type="text"
                value={createForm.uri}
                onChange={(e) =>
                  setCreateForm({ ...createForm, uri: e.target.value })
                }
                placeholder="https://example.com/metadata.json"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white font-medium mb-2">
                Initial Supply
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
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-white font-medium mb-2">
                Price per Token (lamports) - Current:{" "}
                {createForm.pricePerToken / LAMPORTS_PER_SOL} SOL
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
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={createMemeCoin}
            disabled={loading || !wallet.connected}
            className="mt-6 w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-4 px-8 rounded-lg transition-all"
          >
            {loading ? "Creating..." : "Create Meme Coin 🚀"}
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 mb-8 border border-white/20">
          <h2 className="text-3xl font-bold text-white mb-6">Buy Meme Coin</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-white font-medium mb-2">
                Coin Name
              </label>
              <input
                type="text"
                value={buyForm.coinName}
                onChange={(e) =>
                  setBuyForm({ ...buyForm, coinName: e.target.value })
                }
                placeholder="Enter coin name"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-green-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white font-medium mb-2">
                Amount
              </label>
              <input
                type="number"
                value={buyForm.amount}
                onChange={(e) =>
                  setBuyForm({ ...buyForm, amount: parseInt(e.target.value) })
                }
                min="1"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-green-400 focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={() => buyMemeCoin(buyForm.coinName, buyForm.amount)}
            disabled={loading || !wallet.connected}
            className="mt-6 w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-4 px-8 rounded-lg transition-all"
          >
            {loading ? "Buying..." : "Buy Tokens 💰"}
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 mb-8 border border-white/20">
          <h2 className="text-3xl font-bold text-white mb-6">Sell Meme Coin</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-white font-medium mb-2">
                Coin Name
              </label>
              <input
                type="text"
                value={sellForm.coinName}
                onChange={(e) =>
                  setSellForm({ ...sellForm, coinName: e.target.value })
                }
                placeholder="Enter coin name"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-red-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white font-medium mb-2">
                Amount
              </label>
              <input
                type="number"
                value={sellForm.amount}
                onChange={(e) =>
                  setSellForm({ ...sellForm, amount: parseInt(e.target.value) })
                }
                min="1"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-red-400 focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={() => sellMemeCoin(sellForm.coinName, sellForm.amount)}
            disabled={loading || !wallet.connected}
            className="mt-6 w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-4 px-8 rounded-lg transition-all"
          >
            {loading ? "Selling..." : "Sell Tokens 💸"}
          </button>
        </div>

        {wallet.connected && userTokens.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 mb-8 border border-white/20">
            <h2 className="text-3xl font-bold text-white mb-6">
              🎯 Your Portfolio
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userTokens.map((token, index) => (
                <div
                  key={index}
                  className="bg-white/5 rounded-lg p-4 border border-white/10"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">
                      {token.name}
                    </h3>
                    <span className="text-sm bg-blue-500 text-white px-2 py-1 rounded">
                      {token.symbol}
                    </span>
                  </div>
                  <div className="space-y-1 text-gray-300">
                    <p>
                      Balance:{" "}
                      <span className="text-green-400 font-medium">
                        {token.balance}
                      </span>
                    </p>
                    <p>
                      Price:{" "}
                      <span className="text-yellow-400">
                        {(token.pricePerToken / LAMPORTS_PER_SOL).toFixed(6)}{" "}
                        SOL
                      </span>
                    </p>
                    <p>
                      Value:{" "}
                      <span className="text-purple-400">
                        {(
                          (token.balance * token.pricePerToken) /
                          LAMPORTS_PER_SOL
                        ).toFixed(6)}{" "}
                        SOL
                      </span>
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => buyMemeCoin(token.name, 1)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-2 rounded"
                    >
                      Buy More
                    </button>
                    <button
                      onClick={() =>
                        sellMemeCoin(token.name, Math.min(10, token.balance))
                      }
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded"
                    >
                      Sell
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 mb-8 border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-white">
              🪙 Available Meme Coins
            </h2>
            <button
              onClick={loadAvailableCoins}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
          <div className="mb-4 text-sm text-gray-400">
            Debug: Coins loaded: {coins.length} | Wallet connected:{" "}
            {wallet.connected ? "✅" : "❌"} | Mounted: {mounted ? "✅" : "❌"}
          </div>
          {coins.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coins.map((coin, index) => (
                <div
                  key={index}
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">
                      {coin.name}
                    </h3>
                    <span className="text-sm bg-purple-500 text-white px-2 py-1 rounded">
                      {coin.symbol}
                    </span>
                  </div>
                  <div className="space-y-1 text-gray-300 text-sm">
                    <p>
                      Creator:{" "}
                      <span className="text-blue-400 font-mono text-xs">
                        {coin.creator.toString().slice(0, 8)}...
                      </span>
                    </p>
                    <p>
                      Total Supply:{" "}
                      <span className="text-yellow-400">
                        {coin.totalSupply.toLocaleString()}
                      </span>
                    </p>
                    <p>
                      Price:{" "}
                      <span className="text-green-400">
                        {coin.priceInSOL.toFixed(6)} SOL
                      </span>
                    </p>
                    <p>
                      Volume:{" "}
                      <span className="text-purple-400">
                        {(coin.totalVolume / LAMPORTS_PER_SOL).toFixed(2)} SOL
                      </span>
                    </p>
                    <p>
                      Holders:{" "}
                      <span className="text-orange-400">
                        {coin.holdersCount}
                      </span>
                    </p>
                    <p
                      className={`font-medium ${
                        coin.isActive ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {coin.isActive ? "🟢 Active" : "🔴 Inactive"}
                    </p>
                  </div>
                  {coin.isActive && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => buyMemeCoin(coin.name, 1)}
                        disabled={loading || !wallet.connected}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-2 px-3 rounded transition-colors disabled:opacity-50"
                      >
                        Quick Buy
                      </button>
                      <button
                        onClick={() => {
                          const userToken = userTokens.find(
                            (t) => t.name === coin.name
                          );
                          if (userToken) {
                            sellMemeCoin(
                              coin.name,
                              Math.min(10, userToken.balance)
                            );
                          }
                        }}
                        disabled={
                          loading ||
                          !wallet.connected ||
                          !userTokens.find((t) => t.name === coin.name)
                        }
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-2 px-3 rounded transition-colors disabled:opacity-50"
                      >
                        Quick Sell
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <p className="text-lg mb-2">No meme coins found yet</p>
              <p className="text-sm">
                Create the first one above, or click refresh to check for
                existing coins! 🚀
              </p>
              <p className="text-xs mt-2 text-gray-500">
                Debug: Coins array length: {coins.length}
              </p>
            </div>
          )}
        </div>

        <div className="bg-yellow-500/20 border border-yellow-400 rounded-lg p-4 text-center">
          <p className="text-yellow-200">
            🔧 <strong>Development Mode:</strong> Connected to Solana Devnet
          </p>
          <p className="text-yellow-200 text-sm mt-2">
            Program ID: {PROGRAM_ID.toString()}
          </p>
        </div>
      </div>
    </main>
  );
}
