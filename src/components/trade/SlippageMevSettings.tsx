import React from "react";
import { cn } from "@/lib/utils";
import { PresetConfig } from "@/types/trade";

interface SlippageMevSettingsProps {
  config: PresetConfig;
  onToggleSlippage: () => void;
  onToggleMev: () => void;
}

export const SlippageMevSettings: React.FC<SlippageMevSettingsProps> = ({
  config,
  onToggleSlippage,
  onToggleMev,
}) => {
  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        onClick={onToggleSlippage}
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
      >
        <span className="text-muted-foreground">※</span>
        <span className="text-white font-medium">
          {config.slippage === "auto" ? "AUTO" : `${config.slippage}%`}
        </span>
      </button>
      <button
        onClick={onToggleMev}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
          config.mevProtection
            ? "bg-cyan-500/20 text-cyan-400"
            : "bg-white/5 text-muted-foreground"
        )}
      >
        <span>◇</span>
        <span className="font-medium">
          MEV {config.mevProtection ? "ON" : "OFF"}
        </span>
      </button>
    </div>
  );
};
