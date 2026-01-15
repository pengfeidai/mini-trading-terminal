import React from "react";
import { cn } from "@/lib/utils";
import { CopyIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TradeSectionProps {
  type: "buy" | "sell";
  presets: number[];
  balance: number;
  balanceSymbol?: string;
  tokenSymbol?: string;
  isEditMode: boolean;
  editValues: string[];
  onEditChange: (index: number, value: string) => void;
  onTrade: (amount: number) => void;
  onCopyAddress: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
}

export const TradeSection: React.FC<TradeSectionProps> = ({
  type,
  presets,
  balance,
  balanceSymbol,
  tokenSymbol,
  isEditMode,
  editValues,
  onEditChange,
  onTrade,
  onCopyAddress,
  disabled = false,
  isSubmitting = false,
}) => {
  const isBuy = type === "buy";
  
  const buttonStyles = isBuy
    ? {
        base: "bg-green-500/10 border border-green-500/30 text-green-400",
        hover: "hover:bg-green-500/20 hover:border-green-500/50",
        editInput: "bg-green-500/10 border-green-500/30 text-green-400",
      }
    : {
        base: "bg-muted/30 border border-border text-white",
        hover: "hover:bg-muted/50 hover:border-muted-foreground/50",
        editInput: "bg-muted/30 border-border text-white",
      };

  const formatBalance = () => {
    if (isBuy) {
      return balance.toFixed(2);
    }
    return balance.toLocaleString();
  };

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white capitalize">{type}</span>
        <button
          onClick={onCopyAddress}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
          title="Copy wallet address"
        >
          <CopyIcon className="w-3 h-3" />
          <span>{formatBalance()}</span>
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
              className={cn("h-10 text-center text-sm", buttonStyles.editInput)}
              placeholder="0"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {presets.map((preset) => {
            const isDisabled = disabled || isSubmitting || (isBuy ? balance < preset : balance <= 0);
            
            return (
              <button
                key={`${type}-${preset}`}
                onClick={() => onTrade(preset)}
                disabled={isDisabled}
                className={cn(
                  "py-2.5 px-2 rounded-lg text-sm font-medium transition-all",
                  buttonStyles.base,
                  buttonStyles.hover,
                  "active:scale-95",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
                title={!isBuy ? `Sell ${preset}% of ${tokenSymbol || "token"} balance` : undefined}
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
              ${((balance * preset / 100) * 0).toFixed(0)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
