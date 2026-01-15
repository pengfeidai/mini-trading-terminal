import React from "react";

interface TradeLoadingStateProps {
  message?: string;
}

export const TradeLoadingState: React.FC<TradeLoadingStateProps> = ({
  message = "Processing...",
}) => {
  return (
    <div className="flex items-center justify-center gap-2 py-3 bg-white/5 rounded-lg">
      <div className="h-2 w-2 bg-cyan-400 rounded-full animate-pulse" />
      <div className="h-2 w-2 bg-cyan-400 rounded-full animate-pulse [animation-delay:75ms]" />
      <div className="h-2 w-2 bg-cyan-400 rounded-full animate-pulse [animation-delay:150ms]" />
      <span className="text-sm text-muted-foreground ml-2">{message}</span>
    </div>
  );
};
