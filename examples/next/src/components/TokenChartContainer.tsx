"use server";

import { sdk } from "../sdk";
import { TokenChart } from "./TokenChart";

type TokenChartProps = {
  id: string;
};

export async function TokenChartContainer({ id }: TokenChartProps) {
  const sparklines = await sdk.queries.tokenSparklines({
    input: { ids: [id] },
  });

  const chartData = sparklines.tokenSparklines[0].sparkline.map((s) => ({
    timestamp: s.timestamp,
    price: s.value,
  }));

  return <TokenChart data={chartData} />;
}
