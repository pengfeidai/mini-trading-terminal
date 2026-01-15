import React, { useState, useCallback, useMemo, memo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DraggableWindow } from "@/components/ui/draggable-window";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EnhancedToken } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { useBalance } from "@/hooks/use-balance";
import { useTrade } from "@/hooks/use-trade";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import {
  confirmTransaction,
  createConnection,
  createKeypair,
  sendTransaction,
  signTransaction,
} from "@/lib/solana";
import { NATIVE_MINT } from "@solana/spl-token";
import { PairWithMetadata } from "@/lib/codex";

// Type for the data expected by the chart (from getBars)
// Adjust based on actual getBars response structure
export interface ChartDataPoint {
  time: number; // Assuming timestamp
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  // Add other fields like volume if needed
}

interface TokenChartProps {
  data: ChartDataPoint[];
  title?: string;
  token?: EnhancedToken;
  pairs?: PairWithMetadata[];
}

export const TokenChart: React.FC<TokenChartProps> = memo(
  ({ data, title = "Price Chart", token, pairs = [] }) => {
    const [isTradeWindowOpen, setIsTradeWindowOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isDesktop = useIsDesktop();

    // Get balance and trade hooks
    const {
      nativeBalance: solanaBalance,
      tokenBalance,
      tokenAtomicBalance,
      loading,
      refreshBalance,
    } = useBalance(
      token?.address || "",
      Number(token?.decimals || 18),
      9,
      Number(token?.networkId || 0)
    );

    // Memoize keypair and connection to avoid recreating on every render
    const keypair = useMemo(
      () => createKeypair(import.meta.env.VITE_SOLANA_PRIVATE_KEY),
      []
    );
    const connection = useMemo(() => createConnection(), []);

    // Find CPMM pool
    const cpmmPoolInfo = useMemo(() => {
      if (!token || pairs.length === 0) return null;

      const solMint = NATIVE_MINT.toBase58();
      const solPairedPool = pairs.find((pair) => {
        const token0 = pair.pair?.token0;
        const token1 = pair.pair?.token1;
        return token0 === solMint || token1 === solMint;
      });

      if (solPairedPool) {
        return {
          poolAddress: solPairedPool.pair?.address || null,
          token0: solPairedPool.pair?.token0,
          token1: solPairedPool.pair?.token1,
        };
      }

      return null;
    }, [pairs, token]);

    const { createTransaction } = useTrade(
      token?.address || "",
      tokenAtomicBalance,
      cpmmPoolInfo?.poolAddress || undefined
    );

    const handleTrade = useCallback(
      async (direction: "buy" | "sell", amount: number) => {
        if (isSubmitting || !token) return;
        setIsSubmitting(true);

        // For sell, amount is already percentage
        const tradeValue = amount;

        const toastId = toast.loading(`Creating ${direction} transaction...`);
        try {
          const { transaction } = await createTransaction({
            direction,
            value: tradeValue,
            signer: keypair.publicKey,
            slippageBps: 100,
          });

          toast.loading("Signing transaction...", { id: toastId });
          const signedTransaction = signTransaction(keypair, transaction);

          toast.loading("Sending transaction...", { id: toastId });
          const signature = await sendTransaction(
            signedTransaction,
            connection
          );

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

          setTimeout(refreshBalance, 1000);
        } catch (error) {
          console.error("Trade error:", error);
          toast.error((error as Error).message, { id: toastId });
        } finally {
          setIsSubmitting(false);
        }
      },
      [
        token,
        createTransaction,
        keypair,
        connection,
        refreshBalance,
        isSubmitting,
      ]
    );

    const solBuyAmountPresets = [0.0001, 0.001, 0.01, 0.1];
    const percentagePresets = [25, 50, 75, 100];

    if (!data || data.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No chart data available.</p>
          </CardContent>
        </Card>
      );
    }

    // Format timestamp for XAxis
    const formatXAxis = (tickItem: number) => {
      return new Date(tickItem * 1000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    };

    // Format tooltip value
    const formatTooltipValue = (value: number) => {
      return value.toFixed(4); // Adjust precision as needed
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="time"
                tickFormatter={formatXAxis}
                stroke="#AAAAAA"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#AAAAAA"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  color: "#FFFFFF",
                }}
                labelFormatter={formatXAxis}
                formatter={formatTooltipValue}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#FFFFFF"
                activeDot={{ r: 8 }}
                dot={false}
              />
              {/* Add lines for open, high, low if needed */}
            </LineChart>
          </ResponsiveContainer>
          {isDesktop && (
            <button
              onClick={() => setIsTradeWindowOpen(true)}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Instant Trade
            </button>
          )}
        </CardContent>

        {isDesktop && (
          <DraggableWindow
            open={isTradeWindowOpen}
            onClose={() => setIsTradeWindowOpen(false)}
            title="Instant Trade"
            defaultPosition={{ x: 200, y: 200 }}
            defaultSize={{ width: 420, height: 500 }}
            minWidth={350}
            minHeight={400}
            maxWidth={800}
            maxHeight={900}
          >
            {token && cpmmPoolInfo ? (
              <div className="space-y-4">
                {/* Balance Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-1.5">
                      SOL Balance
                    </div>
                    <div className="text-lg font-bold text-green-400">
                      {solanaBalance.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-1.5">
                      {token.symbol} Balance
                    </div>
                    <div className="text-lg font-bold text-red-400">
                      {tokenBalance.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Buy Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1 w-8 bg-gradient-to-r from-green-500 to-green-400 rounded-full" />
                    <span className="text-base font-bold text-green-400">
                      Buy
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2.5">
                    {solBuyAmountPresets.map((preset) => (
                      <button
                        key={`buy-${preset}`}
                        onClick={() => handleTrade("buy", preset)}
                        disabled={
                          loading || isSubmitting || solanaBalance < preset
                        }
                        className={cn(
                          "py-2.5 px-2 rounded-xl text-sm font-semibold transition-all",
                          "bg-gradient-to-br from-green-500/20 to-green-600/20",
                          "text-green-400 border border-green-500/40",
                          "hover:from-green-500/30 hover:to-green-600/30",
                          "hover:border-green-500/60 hover:shadow-lg hover:shadow-green-500/20",
                          "active:scale-95",
                          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
                          "disabled:hover:shadow-none"
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 text-xs text-muted-foreground rounded-full">
                      or
                    </span>
                  </div>
                </div>

                {/* Sell Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1 w-8 bg-gradient-to-r from-red-500 to-red-400 rounded-full" />
                    <span className="text-base font-bold text-red-400">
                      Sell
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2.5">
                    {percentagePresets.map((preset) => (
                      <button
                        key={`sell-${preset}`}
                        onClick={() => handleTrade("sell", preset)}
                        disabled={loading || isSubmitting || tokenBalance <= 0}
                        className={cn(
                          "py-2.5 px-2 rounded-xl text-sm font-semibold transition-all",
                          "bg-gradient-to-br from-red-500/20 to-red-600/20",
                          "text-red-400 border border-red-500/40",
                          "hover:from-red-500/30 hover:to-red-600/30",
                          "hover:border-red-500/60 hover:shadow-lg hover:shadow-red-500/20",
                          "active:scale-95",
                          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
                          "disabled:hover:shadow-none"
                        )}
                        title={`Sell ${preset}% of ${token.symbol} balance`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Loading State */}
                {isSubmitting && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                    <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse delay-75" />
                    <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse delay-150" />
                    <span className="text-sm text-muted-foreground ml-2">
                      Processing transaction...
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="text-4xl mb-2">⚠️</div>
                <div className="text-sm text-muted-foreground">
                  {!token
                    ? "Token information not available"
                    : "No trading pool found"}
                </div>
              </div>
            )}
          </DraggableWindow>
        )}
      </Card>
    );
  }
);

TokenChart.displayName = "TokenChart";
