// Trade-related type definitions

export type PresetTab = "P1" | "P2" | "P3";

export type SettingsSection = "buy" | "sell";

export interface PresetConfig {
  buyPresets: number[];
  sellPresets: number[];
  slippage: number | "auto";
  mevProtection: boolean;
  gasFee: number | "auto";
}

export type PresetsState = Record<PresetTab, PresetConfig>;

export interface TradeParams {
  direction: "buy" | "sell";
  value: number;
  slippageBps: number;
}

// Default presets for each tab
export const DEFAULT_PRESETS: PresetsState = {
  P1: {
    buyPresets: [0.001, 0.01, 0.1, 1],
    sellPresets: [10, 25, 50, 100],
    slippage: 20,
    mevProtection: true,
    gasFee: "auto",
  },
  P2: {
    buyPresets: [0.01, 0.05, 0.1, 0.5],
    sellPresets: [25, 50, 75, 100],
    slippage: 20,
    mevProtection: true,
    gasFee: "auto",
  },
  P3: {
    buyPresets: [0.1, 0.5, 1, 5],
    sellPresets: [10, 25, 50, 100],
    slippage: 10,
    mevProtection: false,
    gasFee: 0.001,
  },
};

export const PRESET_TABS: PresetTab[] = ["P1", "P2", "P3"];

export const PRESET_TAB_LABELS: Record<PresetTab, string> = {
  P1: "Preset 1",
  P2: "Preset 2",
  P3: "Preset 3",
};

export const TRADE_PRESETS_STORAGE_KEY = "instant-trade-presets";
