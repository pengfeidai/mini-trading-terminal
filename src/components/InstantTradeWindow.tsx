import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EnhancedToken } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { PairWithMetadata } from "@/lib/codex";
import { useBalance } from "@/hooks/use-balance";
import { useTrade } from "@/hooks/use-trade";
import { useTradePresets } from "@/hooks/use-trade-presets";
import {
  confirmTransaction,
  createConnection,
  createKeypair,
  sendTransaction,
  signTransaction,
} from "@/lib/solana";
import { NATIVE_MINT } from "@solana/spl-token";
import { DraggableWindow } from "@/components/ui/draggable-window";
import { Input } from "@/components/ui/input";
import { TradeSettingsDialog } from "@/components/trade/TradeSettingsDialog";
import {
  PencilIcon,
  RefreshCwIcon,
  XIcon,
  SettingsIcon,
  CopyIcon,
} from "lucide-react";
import { PresetTab, PRESET_TABS } from "@/types/trade";

interface InstantTradeWindowProps {
  open: boolean;
  onClose: () => void;
  token: EnhancedToken;
  pairs: PairWithMetadata[];
}

export const InstantTradeWindow: React.FC<InstantTradeWindowProps> = ({
  open,
  onClose,
  token,
  pairs,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Trade presets hook
  const {
    activePreset,
    presets,
    currentConfig,
    isEditMode,
    editBuyPresets,
    editSellPresets,
    setActivePreset,
    setIsEditMode,
    setEditBuyPresets,
    setEditSellPresets,
    handleSaveEdit,
    handleToggleSlippage,
    handleToggleMev,
    setSlippage,
    setMevProtection,
    setGasFee,
  } = useTradePresets();

  // Balance hook
  const {
    nativeBalance: solanaBalance,
    tokenBalance,
    tokenAtomicBalance,
    loading,
    refreshBalance,
  } = useBalance(
    token.address,
    Number(token.decimals || 18),
    9,
    Number(token.networkId || 0)
  );

  // Memoize keypair and connection
  const keypair = useMemo(
    () => createKeypair(import.meta.env.VITE_SOLANA_PRIVATE_KEY),
    []
  );
  const connection = useMemo(() => createConnection(), []);

  // Find CPMM pool
  const cpmmPoolInfo = useMemo(() => {
    if (pairs.length === 0) return null;

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
  }, [pairs]);

  const { createTransaction } = useTrade(
    token.address,
    tokenAtomicBalance,
    cpmmPoolInfo?.poolAddress || undefined
  );

  // Copy wallet address
  const handleCopyAddress = useCallback(() => {
    navigator.clipboard.writeText(keypair.publicKey.toBase58());
    toast.success("Wallet address copied!");
  }, [keypair]);

  // Handle trade execution
  const handleTrade = useCallback(
    async (direction: "buy" | "sell", amount: number) => {
      if (isSubmitting) return;
      setIsSubmitting(true);

      const slippageBps =
        currentConfig.slippage === "auto" ? 100 : currentConfig.slippage * 100;

      const toastId = toast.loading(`Creating ${direction} transaction...`);
      try {
        const { transaction } = await createTransaction({
          direction,
          value: amount,
          signer: keypair.publicKey,
          slippageBps,
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

        setTimeout(refreshBalance, 1000);
      } catch (error) {
        console.error("Trade error:", error);
        toast.error((error as Error).message, { id: toastId });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      createTransaction,
      keypair,
      connection,
      refreshBalance,
      currentConfig.slippage,
      isSubmitting,
    ]
  );

  // Handle close
  const handleClose = useCallback(() => {
    setIsEditMode(false);
    onClose();
  }, [onClose, setIsEditMode]);

  // Render trade section (Buy or Sell)
  const renderTradeSection = (
    type: "buy" | "sell",
    presets: number[],
    balance: number,
    editValues: string[],
    onEditChange: (index: number, value: string) => void
  ) => {
    const isBuy = type === "buy";

    return (
      <div className="space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white capitalize">
            {type}
          </span>
          <button
            onClick={handleCopyAddress}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
            title="Copy wallet address"
          >
            <CopyIcon className="w-3 h-3" />
            <span>{isBuy ? balance.toFixed(2) : balance.toLocaleString()}</span>
            <span className={isBuy ? "text-cyan-400" : "text-purple-400"}>
              {isBuy ? "◆" : "◈"}
            </span>
          </button>
        </div>

        {/* Preset Buttons or Edit Inputs */}
        {isEditMode ? (
          <div className="grid grid-cols-4 gap-2">
            {editValues.map((value, index) => (
              <Input
                key={`edit-${type}-${index}`}
                type="number"
                value={value}
                onChange={(e) => onEditChange(index, e.target.value)}
                className={cn(
                  "h-10 text-center text-sm",
                  isBuy
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-muted/30 border-border text-white"
                )}
                placeholder="0"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {presets.map((preset) => {
              const isDisabled =
                loading ||
                isSubmitting ||
                (isBuy ? balance < preset : balance <= 0);

              return (
                <button
                  key={`${type}-${preset}`}
                  onClick={() => handleTrade(type, preset)}
                  disabled={isDisabled}
                  className={cn(
                    "py-2.5 px-2 rounded-lg text-sm font-medium transition-all active:scale-95",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    isBuy
                      ? "bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500/50"
                      : "bg-muted/30 border border-border text-white hover:bg-muted/50 hover:border-muted-foreground/50"
                  )}
                  title={
                    !isBuy
                      ? `Sell ${preset}% of ${token.symbol || "token"} balance`
                      : undefined
                  }
                >
                  {isBuy ? preset : `${preset}%`}
                </button>
              );
            })}
          </div>
        )}

        {/* USD Estimates for Sell */}
        {!isBuy && !isEditMode && (
          <div className="grid grid-cols-4 gap-2 mt-1">
            {presets.map((preset) => (
              <div
                key={`usd-${preset}`}
                className="text-center text-xs text-muted-foreground"
              >
                ${(((balance * preset) / 100) * 0).toFixed(0)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <DraggableWindow
      open={open}
      onClose={handleClose}
      title=""
      defaultPosition={{ x: 200, y: 200 }}
      defaultSize={{ width: 380, height: 520 }}
      minWidth={340}
      minHeight={450}
      maxWidth={800}
      maxHeight={900}
      className="!p-0"
    >
      {cpmmPoolInfo ? (
        <div className="flex flex-col h-full -m-5">
          {/* Header with Tabs */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            {/* Preset Tabs */}
            <div className="flex items-center gap-1">
              {PRESET_TABS.map((preset: PresetTab) => (
                <button
                  key={preset}
                  onClick={() => setActivePreset(preset)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                    activePreset === preset
                      ? "bg-white/10 text-white"
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  {preset}
                </button>
              ))}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-muted-foreground hover:text-white transition-colors ml-1"
                title="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {isEditMode ? (
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                >
                  Save
                </button>
              ) : (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="p-1.5 text-muted-foreground hover:text-white transition-colors"
                  title="Edit presets"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={refreshBalance}
                disabled={loading}
                className={cn(
                  "p-1.5 text-muted-foreground hover:text-white transition-colors",
                  loading && "animate-spin"
                )}
                title="Refresh balance"
              >
                <RefreshCwIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 text-muted-foreground hover:text-white transition-colors"
                title="Close"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 space-y-4 overflow-auto">
            {/* Buy Section */}
            {renderTradeSection(
              "buy",
              currentConfig.buyPresets,
              solanaBalance,
              editBuyPresets,
              (index, value) => {
                setEditBuyPresets((prev) => {
                  const newPresets = [...prev];
                  newPresets[index] = value;
                  return newPresets;
                });
              }
            )}

            {/* Slippage & MEV Settings */}
            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={handleToggleSlippage}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
              >
                <span className="text-muted-foreground">※</span>
                <span className="text-white font-medium">
                  {currentConfig.slippage === "auto"
                    ? "AUTO"
                    : `${currentConfig.slippage}%`}
                </span>
              </button>
              <button
                onClick={handleToggleMev}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
                  currentConfig.mevProtection
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-white/5 text-muted-foreground"
                )}
              >
                <span>◇</span>
                <span className="font-medium">
                  MEV {currentConfig.mevProtection ? "ON" : "OFF"}
                </span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/30" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">
                  OR
                </span>
              </div>
            </div>

            {/* Sell Section */}
            {renderTradeSection(
              "sell",
              currentConfig.sellPresets,
              tokenBalance,
              editSellPresets,
              (index, value) => {
                setEditSellPresets((prev) => {
                  const newPresets = [...prev];
                  newPresets[index] = value;
                  return newPresets;
                });
              }
            )}

            {/* Loading State */}
            {isSubmitting && (
              <div className="flex items-center justify-center gap-2 py-3 bg-white/5 rounded-lg">
                <div className="h-2 w-2 bg-cyan-400 rounded-full animate-pulse" />
                <div className="h-2 w-2 bg-cyan-400 rounded-full animate-pulse [animation-delay:75ms]" />
                <div className="h-2 w-2 bg-cyan-400 rounded-full animate-pulse [animation-delay:150ms]" />
                <span className="text-sm text-muted-foreground ml-2">
                  Processing...
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <div className="text-sm text-muted-foreground">
            No trading pool found
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      <TradeSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        activePreset={activePreset}
        presets={presets}
        onPresetChange={setActivePreset}
        onSlippageChange={setSlippage}
        onMevChange={setMevProtection}
        onGasFeeChange={setGasFee}
      />
    </DraggableWindow>
  );
};
