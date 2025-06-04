"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import WalletButton from "@/components/WalletButton";

// Import your IDL
import idl from "@/idl/meme_coin_program.json";

const PROGRAM_ID = new PublicKey(
  "5ZCsDZAV9oH7Souj6UWtX3Q94ZrmPkVF5MVQuzmDd66X"
);

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [mounted, setMounted] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: "",
    symbol: "",
    uri: "",
    decimals: 9,
    initialSupply: 1000000,
    pricePerToken: 1000000, // 0.001 SOL in lamports
  });

  const [buyForm, setBuyForm] = useState({
    coinName: "",
    amount: 1,
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get Anchor program instance
  const getProgram = () => {
    if (!wallet.wallet?.adapter) return null;

    const provider = new anchor.AnchorProvider(
      connection,
      wallet as any,
      anchor.AnchorProvider.defaultOptions()
    );

    return new anchor.Program(idl as any, PROGRAM_ID, provider);
  };

  // Create a new meme coin
  const createMemeCoin = async () => {
    if (!wallet.publicKey) {
      setStatus("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setStatus("Creating meme coin...");

    try {
      const program = getProgram();
      if (!program) throw new Error("Program not initialized");

      // Generate mint keypair
      const mint = anchor.web3.Keypair.generate();

      // Find PDA for meme coin account
      const [memeCoinPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("meme_coin"), Buffer.from(createForm.name)],
        PROGRAM_ID
      );

      const tx = await program.methods
        .createMemeCoin(
          createForm.name,
          createForm.symbol,
          createForm.uri,
          createForm.decimals,
          new anchor.BN(createForm.initialSupply),
          new anchor.BN(createForm.pricePerToken)
        )
        .accounts({
          memeCoin: memeCoinPda,
          mint: mint.publicKey,
          creator: wallet.publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mint])
        .rpc();

      setStatus(`Meme coin created! TX: ${tx}`);
      console.log("Transaction:", tx);

      // Reset form
      setCreateForm({
        name: "",
        symbol: "",
        uri: "",
        decimals: 9,
        initialSupply: 1000000,
        pricePerToken: 1000000,
      });
    } catch (error) {
      console.error("Error creating meme coin:", error);
      setStatus(`Error: ${error}`);
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
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🚀 Meme Coin Factory
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Create, buy, and sell meme coins on Solana Devnet
          </p>
          <WalletButton />
        </div>

        {/* Status */}
        {status && (
          <div className="bg-blue-800/50 border border-blue-400 rounded-lg p-4 mb-8 text-center">
            <p className="text-white">{status}</p>
          </div>
        )}

        {/* Create Meme Coin */}
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

        {/* Network Info */}
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
