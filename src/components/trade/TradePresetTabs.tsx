import React from "react";
import { cn } from "@/lib/utils";
import { PresetTab, PRESET_TABS } from "@/types/trade";
import { SettingsIcon } from "lucide-react";
import { toast } from "sonner";

interface TradePresetTabsProps {
  activePreset: PresetTab;
  onPresetChange: (preset: PresetTab) => void;
  onSettingsClick?: () => void;
}

export const TradePresetTabs: React.FC<TradePresetTabsProps> = ({
  activePreset,
  onPresetChange,
  onSettingsClick,
}) => {
  return (
    <div className="flex items-center gap-1">
      {PRESET_TABS.map((preset) => (
        <button
          key={preset}
          onClick={() => onPresetChange(preset)}
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
        onClick={onSettingsClick || (() => toast.info("Settings coming soon!"))}
        className="p-1.5 text-muted-foreground hover:text-white transition-colors ml-1"
        title="Settings"
      >
        <SettingsIcon className="w-4 h-4" />
      </button>
    </div>
  );
};
