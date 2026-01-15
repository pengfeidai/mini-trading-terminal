import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PresetTab,
  PresetsState,
  PRESET_TABS,
  PRESET_TAB_LABELS,
  SettingsSection,
} from "@/types/trade";
import { InfoIcon } from "lucide-react";

interface TradeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activePreset: PresetTab;
  presets: PresetsState;
  onPresetChange: (preset: PresetTab) => void;
  onSlippageChange: (value: number | "auto") => void;
  onMevChange: (enabled: boolean) => void;
  onGasFeeChange: (value: number | "auto") => void;
}

export const TradeSettingsDialog: React.FC<TradeSettingsDialogProps> = ({
  open,
  onOpenChange,
  activePreset,
  presets,
  onPresetChange,
  onSlippageChange,
  onMevChange,
  onGasFeeChange,
}) => {
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("buy");
  const currentConfig = presets[activePreset];

  // Handle slippage input change
  const handleSlippageChange = useCallback(
    (value: string) => {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
        onSlippageChange(numValue);
      }
    },
    [onSlippageChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-[#1a1a2e] border-border/50">
        <DialogHeader>
          <DialogTitle className="text-white">Trade Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preset Tabs */}
          <div className="flex rounded-lg bg-muted/30 p-1">
            {PRESET_TABS.map((preset) => (
              <button
                key={preset}
                onClick={() => onPresetChange(preset)}
                className={cn(
                  "flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all",
                  activePreset === preset
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                {PRESET_TAB_LABELS[preset]}
              </button>
            ))}
          </div>

          {/* Buy/Sell Settings Toggle */}
          <div className="flex rounded-lg bg-muted/30 p-1">
            <button
              onClick={() => setSettingsSection("buy")}
              className={cn(
                "flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all",
                settingsSection === "buy"
                  ? "bg-green-500/20 text-green-400"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              Buy Settings
            </button>
            <button
              onClick={() => setSettingsSection("sell")}
              className={cn(
                "flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all",
                settingsSection === "sell"
                  ? "bg-muted/50 text-white"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              Sell Settings
            </button>
          </div>

          {/* Slippage Tolerance */}
          <div className="flex items-center justify-between py-3 px-1 rounded-lg bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">Slippage Tolerance</span>
              <InfoIcon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={currentConfig.slippage === "auto" ? 20 : currentConfig.slippage}
                onChange={(e) => handleSlippageChange(e.target.value)}
                className="w-20 h-8 text-center text-sm bg-muted/30 border-border"
                min={0}
                max={100}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          {/* MEV Protection */}
          <div className="flex items-center justify-between py-3 px-1 rounded-lg bg-muted/20">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-sm text-white">MEV Protection</span>
              </div>
              <span className="text-xs text-muted-foreground ml-4">
                Protect trades from front-running
              </span>
            </div>
            <button
              onClick={() => onMevChange(!currentConfig.mevProtection)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                currentConfig.mevProtection ? "bg-cyan-500" : "bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  currentConfig.mevProtection ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Gas Fee */}
          <div className="flex items-center justify-between py-3 px-1 rounded-lg bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">Gas Fee</span>
              <InfoIcon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onGasFeeChange(currentConfig.gasFee === "auto" ? 0.001 : "auto")}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors",
                  currentConfig.gasFee === "auto" ? "bg-cyan-500" : "bg-muted/50"
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                    currentConfig.gasFee === "auto" ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
              <span
                className={cn(
                  "text-sm font-medium min-w-[40px]",
                  currentConfig.gasFee === "auto" ? "text-muted-foreground" : "text-muted-foreground"
                )}
              >
                AUTO
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
