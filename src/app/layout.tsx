import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import  WalletContextProvider  from "@/components/WalletProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Meme Coin Trading Platform",
  description: "Create, buy and sell meme coins on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
