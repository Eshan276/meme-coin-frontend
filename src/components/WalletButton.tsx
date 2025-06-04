// WalletButton.tsx
"use client";

import dynamic from "next/dynamic";

// Dynamically import with SSR disabled
const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function WalletButton() {
  return (
    <WalletMultiButtonDynamic className="!bg-gradient-to-r !from-pink-500 !to-violet-500 hover:!from-pink-600 hover:!to-violet-600" />
  );
}
