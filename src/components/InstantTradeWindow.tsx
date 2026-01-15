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
import {
  TradePresetTabs,
  TradeSection,
  SlippageMevSettings,
  TradeDivider,
  TradeLoadingState,
  TradeSettingsDialog,
} from "@/components/trade";
import { PencilIcon, RefreshCwIcon, XIcon } from "lucide-react";

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
    [createTransaction, keypair, connection, refreshBalance, currentConfig.slippage, isSubmitting]
  );

  // Handle close
  const handleClose = useCallback(() => {
    setIsEditMode(false);
    onClose();
  }, [onClose, setIsEditMode]);

  // Handle edit buy preset change
  const handleEditBuyChange = useCallback(
    (index: number, value: string) => {
      setEditBuyPresets((prev) => {
        const newPresets = [...prev];
        newPresets[index] = value;
        return newPresets;
      });
    },
    [setEditBuyPresets]
  );

  // Handle edit sell preset change
  const handleEditSellChange = useCallback(
    (index: number, value: string) => {
      setEditSellPresets((prev) => {
        const newPresets = [...prev];
        newPresets[index] = value;
        return newPresets;
      });
    },
    [setEditSellPresets]
  );

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
          {/* Custom Header with Tabs */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            {/* Preset Tabs */}
            <TradePresetTabs
              activePreset={activePreset}
              onPresetChange={setActivePreset}
              onSettingsClick={() => setIsSettingsOpen(true)}
            />

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
            <TradeSection
              type="buy"
              presets={currentConfig.buyPresets}
              balance={solanaBalance}
              isEditMode={isEditMode}
              editValues={editBuyPresets}
              onEditChange={handleEditBuyChange}
              onTrade={(amount) => handleTrade("buy", amount)}
              onCopyAddress={handleCopyAddress}
              disabled={loading}
              isSubmitting={isSubmitting}
            />

            {/* Slippage & MEV Settings */}
            <SlippageMevSettings
              config={currentConfig}
              onToggleSlippage={handleToggleSlippage}
              onToggleMev={handleToggleMev}
            />

            {/* Divider */}
            <TradeDivider />

            {/* Sell Section */}
            <TradeSection
              type="sell"
              presets={currentConfig.sellPresets}
              balance={tokenBalance}
              tokenSymbol={token.symbol || undefined}
              isEditMode={isEditMode}
              editValues={editSellPresets}
              onEditChange={handleEditSellChange}
              onTrade={(amount) => handleTrade("sell", amount)}
              onCopyAddress={handleCopyAddress}
              disabled={loading}
              isSubmitting={isSubmitting}
            />

            {/* Loading State */}
            {isSubmitting && <TradeLoadingState />}
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
