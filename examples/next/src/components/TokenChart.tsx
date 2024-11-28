"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

type Point = {
  price: number;
  timestamp: number;
};

type TokenChartProps = {
  data: Point[];
};

export function TokenChart({ data }: TokenChartProps) {
  return (
    <ChartContainer config={chartConfig}>
      <LineChart
        accessibilityLayer
        data={data}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => new Date(value * 1000).toLocaleTimeString()}
        />
        <ChartTooltip
          cursor={true}
          labelFormatter={(l, p) => {
            return new Date(p[0].payload.timestamp * 1000).toLocaleString();
          }}
          content={<ChartTooltipContent />}
        />
        <Line
          dataKey="price"
          type="natural"
          stroke="var(--color-desktop)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
