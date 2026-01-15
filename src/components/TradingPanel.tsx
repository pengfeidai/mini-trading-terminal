import { useCallback, useState, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EnhancedToken } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { useBalance } from "@/hooks/use-balance";
import { useTrade } from "@/hooks/use-trade";
import { confirmTransaction, createConnection, createKeypair, sendTransaction, signTransaction } from "@/lib/solana";
import { RAYDIUM_CPMM_PROGRAM_ID } from "@/lib/raydium";
import { NATIVE_MINT } from "@solana/spl-token";
import { PairWithMetadata } from "@/lib/codex";

interface TradingPanelProps {
  token: EnhancedToken;
  pairs: PairWithMetadata[];
}

export function TradingPanel({ token, pairs }: TradingPanelProps) {
  const tokenSymbol = token.symbol;
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellPercentage, setSellPercentage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { nativeBalance: solanaBalance, tokenBalance, tokenAtomicBalance, loading, refreshBalance } = useBalance(token.address, Number(token.decimals), 9, Number(token.networkId));

  const keypair = createKeypair(import.meta.env.VITE_SOLANA_PRIVATE_KEY);
  const connection = createConnection();

  // 从 pairs 中找到 SOL 配对的 CPMM 池（pairs 已经在上游过滤为只有 Raydium CPMM）
  const cpmmPoolInfo = useMemo(() => {
    console.log("[TradingPanel] Looking for SOL paired pool in CPMM pairs...");
    console.log("[TradingPanel] Total CPMM pairs:", pairs.length);
    
    const solMint = NATIVE_MINT.toBase58();
    
    // pairs 已经都是 Raydium CPMM，只需找 SOL 配对
    const solPairedPool = pairs.find((pair) => {
      const token0 = pair.pair?.token0;
      const token1 = pair.pair?.token1;
      const hasSol = token0 === solMint || token1 === solMint;
      
      console.log("[TradingPanel] Checking pair:", {
        poolAddress: pair.pair?.address,
        token0,
        token1,
        hasSol,
      });
      
      return hasSol;
    });

    if (solPairedPool) {
      const poolAddress = solPairedPool.pair?.address;
      console.log("[TradingPanel] ✓ Found CPMM + SOL pool:", {
        poolAddress,
        exchangeName: solPairedPool.exchange?.name,
        token0: solPairedPool.pair?.token0,
        token1: solPairedPool.pair?.token1,
      });
      
      return {
        poolAddress: poolAddress || null,
        token0: solPairedPool.pair?.token0,
        token1: solPairedPool.pair?.token1,
      };
    }

    // 如果没有 SOL 配对的 CPMM 池，检查 token.exchanges 是否有 CPMM（可能需要 RPC fallback）
    if (pairs.length === 0) {
      console.log("[TradingPanel] No CPMM pairs, checking token.exchanges...");
      const hasCPMMExchange = token.exchanges?.some((exchange) => {
        return exchange.address === RAYDIUM_CPMM_PROGRAM_ID.toBase58() ||
               exchange.name?.includes("Raydium CPMM");
      });

      if (hasCPMMExchange) {
        console.log("[TradingPanel] Token has CPMM exchange, will try RPC fallback");
        return { poolAddress: null, token0: null, token1: null, needsRpcLookup: true };
      }
    }

    console.log("[TradingPanel] No Raydium CPMM + SOL pool found");
    return null;
  }, [pairs, token.exchanges]);

  // 传递池地址给 useTrade
  const { createTransaction } = useTrade(
    token.address, 
    tokenAtomicBalance, 
    cpmmPoolInfo?.poolAddress || undefined
  );

  const handleTrade = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const toastId = toast.loading("Creating swap transaction...");
    try {
      const { transaction, quote } = await createTransaction({ 
        direction: tradeMode, 
        value: tradeMode === "buy" ? parseFloat(buyAmount) : parseFloat(sellPercentage), 
        signer: keypair.publicKey,
        slippageBps: 100, // 1% slippage
      });

      // Log quote info
      console.log("Swap Quote:", {
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        minimumAmountOut: quote.minimumAmountOut,
        priceImpact: `${quote.priceImpact.toFixed(2)}%`,
      });

      toast.loading("Signing transaction...", { id: toastId });
      const signedTransaction = signTransaction(keypair, transaction);

      toast.loading("Sending transaction...", { id: toastId });
      const signature = await sendTransaction(signedTransaction, connection);

      toast.loading("Confirming transaction...", { id: toastId });
      const confirmation = await confirmTransaction(signature, connection);

      if (confirmation.value.err) {
        throw new Error("Trade failed on-chain");
      }
      
      toast.success(
        <div className="flex flex-col gap-1">
          <span>Trade successful!</span>
          <a 
            href={`https://solscan.io/tx/${signature}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline"
          >
            View on Solscan: {signature.slice(0, 8)}...
          </a>
        </div>, 
        { id: toastId, duration: 5000 }
      ); 

      // Refresh balance after 1 second
      setTimeout(refreshBalance, 1000);
    } catch (error) {
      console.error("Trade error:", error);
      toast.error((error as Error).message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [tradeMode, buyAmount, sellPercentage, createTransaction, keypair, connection, refreshBalance, isSubmitting]);

  const solBuyAmountPresets = [0.0001, 0.001, 0.01, 0.1];
  const percentagePresets = [25, 50, 75, 100];

  // Check for required environment variables
  if (!import.meta.env.VITE_SOLANA_PRIVATE_KEY || !import.meta.env.VITE_HELIUS_RPC_URL) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade {tokenSymbol || "Token"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Trading requires VITE_SOLANA_PRIVATE_KEY and VITE_HELIUS_RPC_URL to be configured in environment variables.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show message if no pool exists
  if (!cpmmPoolInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade {tokenSymbol || "Token"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No Raydium CPMM pool found for this token. Trading is only supported for tokens with a Raydium CPMM pool paired with SOL.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Trade {tokenSymbol || "Token"}</CardTitle>
            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
              Raydium CPMM
            </span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(keypair.publicKey.toBase58());
              toast.success("Wallet address copied!");
            }}
            className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors cursor-pointer"
          >
            {keypair.publicKey.toBase58().slice(0, 4)}...{keypair.publicKey.toBase58().slice(-4)}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
          <span className="text-sm text-muted-foreground">SOL Balance:</span>
          <span className="font-semibold">{solanaBalance.toFixed(4)} SOL</span>
        </div>

        {tokenSymbol && (
          <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
            <span className="text-sm text-muted-foreground">{tokenSymbol} Balance:</span>
            <span className="font-semibold">{tokenBalance.toLocaleString()} {tokenSymbol}</span>
          </div>
        )}

        {cpmmPoolInfo.poolAddress && (
          <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded">
            Pool: {cpmmPoolInfo.poolAddress.slice(0, 8)}...{cpmmPoolInfo.poolAddress.slice(-8)}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setTradeMode("buy")}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg font-medium transition-all",
              tradeMode === "buy"
                ? "bg-green-500/20 text-green-500 border border-green-500/50"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setTradeMode("sell")}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg font-medium transition-all",
              tradeMode === "sell"
                ? "bg-red-500/20 text-red-500 border border-red-500/50"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
          >
            Sell
          </button>
        </div>

        {tradeMode === "buy" ? (
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Amount in SOL</label>
            <div className="flex gap-2">
              {solBuyAmountPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setBuyAmount(preset.toString())}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-all",
                    buyAmount === preset.toString()
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Input
              type="number"
              placeholder="0.00"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <div className="text-xs text-muted-foreground">
              Available: {solanaBalance.toFixed(4)} SOL
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="text-sm text-muted-foreground">Sell Percentage</label>
            <div className="flex gap-2">
              {percentagePresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setSellPercentage(preset.toString())}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-all",
                    sellPercentage === preset.toString()
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {preset}%
                </button>
              ))}
            </div>
            <Input
              type="number"
              placeholder="0"
              value={sellPercentage}
              onChange={(e) => setSellPercentage(e.target.value)}
              min="0"
              max="100"
              step="1"
            />
            {sellPercentage && tokenBalance > 0 && (
              <div className="text-xs text-muted-foreground">
                Selling: {((tokenBalance * parseFloat(sellPercentage)) / 100).toLocaleString()} {tokenSymbol}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleTrade}
          disabled={loading || isSubmitting ||
            (tradeMode === "buy" && (!buyAmount || parseFloat(buyAmount) <= 0)) ||
            (tradeMode === "sell" && (!sellPercentage || parseFloat(sellPercentage) <= 0))
          }
          className={cn(
            "w-full py-3 px-4 rounded-lg font-semibold transition-all",
            tradeMode === "buy"
              ? "bg-green-500 hover:bg-green-600 text-white disabled:bg-green-500/30 disabled:text-green-500/50"
              : "bg-red-500 hover:bg-red-600 text-white disabled:bg-red-500/30 disabled:text-red-500/50",
            "disabled:cursor-not-allowed"
          )}
        >
          {isSubmitting ? "Processing..." : tradeMode === "buy" ? "Buy" : "Sell"} {tokenSymbol || "Token"}
        </button>
      </CardContent>
    </Card>
  );
}
