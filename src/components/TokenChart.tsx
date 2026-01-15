import React, { useState, memo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnhancedToken } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { PairWithMetadata } from "@/lib/codex";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { InstantTradeWindow } from "@/components/InstantTradeWindow";

// Type for the data expected by the chart (from getBars)
export interface ChartDataPoint {
  time: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
}

interface TokenChartProps {
  data: ChartDataPoint[];
  title?: string;
  token?: EnhancedToken;
  pairs?: PairWithMetadata[];
}

export const TokenChart: React.FC<TokenChartProps> = memo(
  ({ data, title = "Price Chart", token, pairs = [] }) => {
    const [isTradeWindowOpen, setIsTradeWindowOpen] = useState(false);
    const isDesktop = useIsDesktop();

    if (!data || data.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No chart data available.</p>
          </CardContent>
        </Card>
      );
    }

    // Format timestamp for XAxis
    const formatXAxis = (tickItem: number) => {
      return new Date(tickItem * 1000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    };

    // Format tooltip value
    const formatTooltipValue = (value: number) => {
      return value.toFixed(4);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="time"
                tickFormatter={formatXAxis}
                stroke="#AAAAAA"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#AAAAAA"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  color: "#FFFFFF",
                }}
                labelFormatter={formatXAxis}
                formatter={formatTooltipValue}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#FFFFFF"
                activeDot={{ r: 8 }}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          
          {isDesktop && token && (
            <button
              onClick={() => setIsTradeWindowOpen(true)}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Instant Trade
            </button>
          )}
        </CardContent>

        {/* Instant Trade Window */}
        {isDesktop && token && (
          <InstantTradeWindow
            open={isTradeWindowOpen}
            onClose={() => setIsTradeWindowOpen(false)}
            token={token}
            pairs={pairs}
          />
        )}
      </Card>
    );
  }
);

TokenChart.displayName = "TokenChart";
