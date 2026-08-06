import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { SeriesPayload, WeeklyPoint } from "@joe/core";

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const ACCENT = "#047857";

export async function mountCharts(
  cumEl: HTMLElement,
  rollEl: HTMLElement,
): Promise<void> {
  const slice = cumEl.dataset.slice || "overall";
  const interpolate = cumEl.dataset.interpolate === "1";

  const res = await fetch(
    `/api/series/${slice}?interpolate=${interpolate ? "1" : "0"}`,
  );
  const data = (await res.json()) as SeriesPayload;

  // Single-season chart (Aug 2026 onward) — one series, no year-over-year.
  const points: WeeklyPoint[] = data.points;
  const yearLabel = data.years[0] != null ? String(data.years[0]) : "2026";

  const baseOption = {
    backgroundColor: "transparent",
    textStyle: { color: MUTED, fontFamily: "Inter, system-ui, sans-serif" },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "#ffffff",
      borderColor: "#cbd5e1",
      borderWidth: 1,
      textStyle: { color: INK, fontSize: 12 },
      extraCssText: "box-shadow:0 4px 16px rgba(15,23,42,0.08);",
    },
    legend: { show: false },
    grid: { left: 8, right: 8, top: 12, bottom: 4, containLabel: true },
    xAxis: {
      type: "value" as const,
      min: 31,
      max: 54,
      interval: 4,
      axisLabel: {
        color: MUTED,
        fontSize: 11,
        formatter: (value: number) => `W${value}`,
      },
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: MUTED, fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: LINE } },
    },
  };

  const cum = echarts.init(cumEl, undefined, { renderer: "canvas" });
  cum.setOption({
    ...baseOption,
    series: [
      {
        name: yearLabel,
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 2.5, color: ACCENT },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(4,120,87,0.14)" },
              { offset: 1, color: "rgba(4,120,87,0)" },
            ],
          },
        },
        data: points.map((p) => [p.week + 30, p.cumulative]),
      },
    ],
  });

  const roll = echarts.init(rollEl, undefined, { renderer: "canvas" });
  roll.setOption({
    ...baseOption,
    series: [
      {
        name: yearLabel,
        type: "bar" as const,
        barMaxWidth: 18,
        itemStyle: { color: ACCENT, borderRadius: [2, 2, 0, 0] },
        data: points.map((p) => [p.week + 30, p.rolling4wk]),
      },
    ],
  });

  window.addEventListener("resize", () => {
    cum.resize();
    roll.resize();
  });
}
