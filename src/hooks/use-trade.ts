import { useCallback } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import Decimal from "decimal.js";
import RaydiumCPMM from "@/lib/raydiumCpmm";
import { bn } from "@/lib/utils";
import { createConnection } from "@/lib/solana";

export interface TradeQuote {
  amountIn: string;
  amountOut: string;
  minimumAmountOut: string;
  priceImpact: number;
}

export const useTrade = (
  tokenAddress: string,
  tokenAtomicBalance: Decimal,
  poolAddress?: string, // 从 Codex API 传入的池地址
) => {
  const createTransaction = useCallback(
    async (params: { direction: "buy" | "sell", value: number, signer: PublicKey, slippageBps?: number }) => {
      const { direction, value, signer, slippageBps = 100 } = params;

      console.log("=== [useTrade] Creating Transaction ===");
      console.log("[useTrade] Direction:", direction);
      console.log("[useTrade] Value:", value);
      console.log("[useTrade] Signer:", signer.toBase58());
      console.log("[useTrade] Token Address:", tokenAddress);
      console.log("[useTrade] Pool Address (from Codex):", poolAddress || "not provided");
      console.log("[useTrade] Token Atomic Balance:", tokenAtomicBalance.toString());

      let atomicAmount;
      if (direction === "buy") {
        // For buy: value is in SOL
        atomicAmount = new Decimal(value).mul(LAMPORTS_PER_SOL);
      } else {
        // For sell: value is percentage of token balance
        atomicAmount = tokenAtomicBalance.mul(value).div(100);
      }

      console.log("[useTrade] Atomic Amount:", atomicAmount.toString());

      // Determine input/output mints based on direction
      const inputMint = direction === "buy" 
        ? NATIVE_MINT 
        : new PublicKey(tokenAddress);
      const outputMint = direction === "buy" 
        ? new PublicKey(tokenAddress) 
        : NATIVE_MINT;

      console.log("[useTrade] Input Mint:", inputMint.toBase58());
      console.log("[useTrade] Output Mint:", outputMint.toBase58());

      // Create Raydium CPMM client
      console.log("[useTrade] Creating Raydium CPMM client...");
      const connection = createConnection();
      const raydium = new RaydiumCPMM(connection);

      // Create swap transaction using Raydium CPMM
      console.log("[useTrade] Calling raydium.createSwapTransaction...");
      const startTime = Date.now();
      
      try {
        // 如果有池地址，直接使用；否则搜索
        const { transaction, quote } = await raydium.createSwapTransaction(
          signer,
          inputMint,
          outputMint,
          bn(atomicAmount),
          slippageBps,
          poolAddress ? new PublicKey(poolAddress) : undefined // 传入池地址
        );

        console.log("[useTrade] Transaction created in", Date.now() - startTime, "ms");
        console.log("[useTrade] Quote:", {
          amountIn: quote.amountIn.toString(),
          amountOut: quote.amountOut.toString(),
          minimumAmountOut: quote.minimumAmountOut.toString(),
          priceImpact: quote.priceImpact,
        });

        return {
          transaction,
          quote: {
            amountIn: quote.amountIn.toString(),
            amountOut: quote.amountOut.toString(),
            minimumAmountOut: quote.minimumAmountOut.toString(),
            priceImpact: quote.priceImpact,
          } as TradeQuote,
        };
      } catch (error) {
        console.error("[useTrade] Error creating transaction:", error);
        throw error;
      }
    },
    [tokenAddress, tokenAtomicBalance, poolAddress],
  );
  
  return {
    createTransaction,
  };
};
