import { useState, useEffect, useCallback } from "react";
import {
  PresetTab,
  PresetConfig,
  PresetsState,
  DEFAULT_PRESETS,
  TRADE_PRESETS_STORAGE_KEY,
} from "@/types/trade";
import { toast } from "sonner";

interface UseTradePresetsReturn {
  // State
  activePreset: PresetTab;
  presets: PresetsState;
  currentConfig: PresetConfig;
  isEditMode: boolean;
  editBuyPresets: string[];
  editSellPresets: string[];

  // Actions
  setActivePreset: (preset: PresetTab) => void;
  setIsEditMode: (isEdit: boolean) => void;
  setEditBuyPresets: React.Dispatch<React.SetStateAction<string[]>>;
  setEditSellPresets: React.Dispatch<React.SetStateAction<string[]>>;
  handleSaveEdit: () => boolean;
  handleToggleSlippage: () => void;
  handleToggleMev: () => void;
  handleToggleGasFee: () => void;
  setSlippage: (value: number | "auto") => void;
  setMevProtection: (enabled: boolean) => void;
  setGasFee: (value: number | "auto") => void;
  setBuyPresets: (presets: number[]) => void;
  setSellPresets: (presets: number[]) => void;
  resetToDefaults: () => void;
}

export function useTradePresets(): UseTradePresetsReturn {
  const [activePreset, setActivePreset] = useState<PresetTab>("P1");
  const [isEditMode, setIsEditMode] = useState(false);
  const [presets, setPresets] = useState<PresetsState>(() => {
    // Load from localStorage or use defaults
    try {
      const saved = localStorage.getItem(TRADE_PRESETS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load presets from localStorage:", e);
    }
    return DEFAULT_PRESETS;
  });

  // Edit mode temp values
  const [editBuyPresets, setEditBuyPresets] = useState<string[]>([]);
  const [editSellPresets, setEditSellPresets] = useState<string[]>([]);

  // Current preset config
  const currentConfig = presets[activePreset];

  // Save presets to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(TRADE_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error("Failed to save presets to localStorage:", e);
    }
  }, [presets]);

  // Initialize edit values when entering edit mode or switching tabs
  useEffect(() => {
    if (isEditMode) {
      setEditBuyPresets(currentConfig.buyPresets.map(String));
      setEditSellPresets(currentConfig.sellPresets.map(String));
    }
  }, [isEditMode, activePreset, currentConfig.buyPresets, currentConfig.sellPresets]);

  // Save edit mode changes
  const handleSaveEdit = useCallback((): boolean => {
    const newBuyPresets = editBuyPresets
      .map((v) => parseFloat(v) || 0)
      .filter((v) => v > 0);
    const newSellPresets = editSellPresets
      .map((v) => parseFloat(v) || 0)
      .filter((v) => v > 0);

    if (newBuyPresets.length === 4 && newSellPresets.length === 4) {
      setPresets((prev) => ({
        ...prev,
        [activePreset]: {
          ...prev[activePreset],
          buyPresets: newBuyPresets,
          sellPresets: newSellPresets,
        },
      }));
      setIsEditMode(false);
      toast.success("Presets saved successfully!");
      return true;
    } else {
      toast.error("Please fill in all 4 buy and sell values");
      return false;
    }
  }, [editBuyPresets, editSellPresets, activePreset]);

  // Toggle slippage between fixed value and auto
  const handleToggleSlippage = useCallback(() => {
    setPresets((prev) => ({
      ...prev,
      [activePreset]: {
        ...prev[activePreset],
        slippage: prev[activePreset].slippage === "auto" ? 20 : "auto",
      },
    }));
  }, [activePreset]);

  // Toggle MEV protection
  const handleToggleMev = useCallback(() => {
    setPresets((prev) => ({
      ...prev,
      [activePreset]: {
        ...prev[activePreset],
        mevProtection: !prev[activePreset].mevProtection,
      },
    }));
  }, [activePreset]);

  // Toggle Gas Fee between fixed value and auto
  const handleToggleGasFee = useCallback(() => {
    setPresets((prev) => ({
      ...prev,
      [activePreset]: {
        ...prev[activePreset],
        gasFee: prev[activePreset].gasFee === "auto" ? 0.001 : "auto",
      },
    }));
  }, [activePreset]);

  // Set specific slippage value
  const setSlippage = useCallback(
    (value: number | "auto") => {
      setPresets((prev) => ({
        ...prev,
        [activePreset]: {
          ...prev[activePreset],
          slippage: value,
        },
      }));
    },
    [activePreset]
  );

  // Set MEV protection
  const setMevProtection = useCallback(
    (enabled: boolean) => {
      setPresets((prev) => ({
        ...prev,
        [activePreset]: {
          ...prev[activePreset],
          mevProtection: enabled,
        },
      }));
    },
    [activePreset]
  );

  // Set specific gas fee value
  const setGasFee = useCallback(
    (value: number | "auto") => {
      setPresets((prev) => ({
        ...prev,
        [activePreset]: {
          ...prev[activePreset],
          gasFee: value,
        },
      }));
    },
    [activePreset]
  );

  // Set buy presets directly
  const setBuyPresets = useCallback(
    (newPresets: number[]) => {
      setPresets((prev) => ({
        ...prev,
        [activePreset]: {
          ...prev[activePreset],
          buyPresets: newPresets,
        },
      }));
    },
    [activePreset]
  );

  // Set sell presets directly
  const setSellPresets = useCallback(
    (newPresets: number[]) => {
      setPresets((prev) => ({
        ...prev,
        [activePreset]: {
          ...prev[activePreset],
          sellPresets: newPresets,
        },
      }));
    },
    [activePreset]
  );

  // Reset to default presets
  const resetToDefaults = useCallback(() => {
    setPresets(DEFAULT_PRESETS);
    toast.success("Presets reset to defaults");
  }, []);

  // Handle preset tab change
  const handleSetActivePreset = useCallback(
    (preset: PresetTab) => {
      setActivePreset(preset);
      if (isEditMode) {
        // Update edit values when switching tabs in edit mode
        setEditBuyPresets(presets[preset].buyPresets.map(String));
        setEditSellPresets(presets[preset].sellPresets.map(String));
      }
    },
    [isEditMode, presets]
  );

  return {
    activePreset,
    presets,
    currentConfig,
    isEditMode,
    editBuyPresets,
    editSellPresets,
    setActivePreset: handleSetActivePreset,
    setIsEditMode,
    setEditBuyPresets,
    setEditSellPresets,
    handleSaveEdit,
    handleToggleSlippage,
    handleToggleMev,
    handleToggleGasFee,
    setSlippage,
    setMevProtection,
    setGasFee,
    setBuyPresets,
    setSellPresets,
    resetToDefaults,
  };
}
