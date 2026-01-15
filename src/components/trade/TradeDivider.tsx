import React from "react";

interface TradeDividerProps {
  text?: string;
}

export const TradeDivider: React.FC<TradeDividerProps> = ({ text = "OR" }) => {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border/30"></div>
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-3 text-xs text-muted-foreground">
          {text}
        </span>
      </div>
    </div>
  );
};
