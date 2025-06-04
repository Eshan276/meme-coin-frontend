"use client";


import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import WalletButton from "@/components/WalletButton";
import idl from "@/idl/meme_coin_program.json";

const PROGRAM_ID = new PublicKey(
  "5ZCsDZAV9oH7Souj6UWtX3Q94ZrmPkVF5MVQuzmDd66X"
);

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

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

const getProgram = () => {
  if (
    !wallet.publicKey ||
    !wallet.signTransaction ||
    !wallet.signAllTransactions
  ) {
    console.error("Wallet not fully connected");
    return null;
  }

  const provider = new anchor.AnchorProvider(
    connection,
    {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction,
    } as anchor.Wallet,
    anchor.AnchorProvider.defaultOptions()
  );
  console.log("Provider:", provider);
  
  return new anchor.Program(idl as anchor.Idl, PROGRAM_ID, provider);
};


  const createMemeCoin = async () => {
    if (!wallet.publicKey) {
      setStatus("Please connect your wallet first");
      return;
    }

    if (
      !createForm.name ||
      !createForm.symbol ||
      !createForm.uri ||
      isNaN(createForm.initialSupply) ||
      isNaN(createForm.pricePerToken)
    ) {
      setStatus("Please fill out all fields with valid values.");
      return;
    }

    setLoading(true);
    setStatus("Creating meme coin...");

    try {
      const program = getProgram();
      if (!program) throw new Error("Program not initialized");

      const mint = anchor.web3.Keypair.generate();

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
          new anchor.BN(Number(createForm.initialSupply)),
          new anchor.BN(Number(createForm.pricePerToken))
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

      setStatus(`✅ Meme coin created! TX: ${tx}`);
      console.log("Transaction:", tx);

      setCreateForm({
        name: "",
        symbol: "",
        uri: "",
        decimals: 9,
        initialSupply: 1000000,
        pricePerToken: 1000000,
      });
    } catch (error: any) {
      console.error("Error creating meme coin:", error);
      setStatus(`❌ Error: ${error.message || error}`);
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
                className="w-full p-3 rounded-lg bg-white/20 text-white"
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
                className="w-full p-3 rounded-lg bg-white/20 text-white"
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
                className="w-full p-3 rounded-lg bg-white/20 text-white"
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
                className="w-full p-3 rounded-lg bg-white/20 text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-white font-medium mb-2">
                Price per Token (lamports) -{" "}
                {(createForm.pricePerToken / LAMPORTS_PER_SOL).toFixed(6)} SOL
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
                className="w-full p-3 rounded-lg bg-white/20 text-white"
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
