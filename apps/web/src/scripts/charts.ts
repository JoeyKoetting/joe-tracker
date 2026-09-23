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
  breakdownEls: {
    jobTypes: HTMLElement | null;
    regions: HTMLElement | null;
    jel: HTMLElement | null;
    deadlines: HTMLElement | null;
  },
): Promise<void> {
  const slice = cumEl.dataset.slice || "overall";
  const interpolate = cumEl.dataset.interpolate === "1";

  const [res, summaryRes] = await Promise.all([
    fetch(`/api/series/${slice}?interpolate=${interpolate ? "1" : "0"}`),
    fetch("/api/analytics-summary"),
  ]);
  if (!res.ok || !summaryRes.ok) throw new Error("Could not load analytics data");
  const data = (await res.json()) as SeriesPayload;
  const summary = await summaryRes.json() as {
    jobTypes: Array<{ label: string; count: number }>;
    regions: Array<{ label: string; count: number }>;
    jel: Array<{ code: string; count: number }>;
    deadlines: Array<{ month: string; count: number }>;
  };

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
      min: 1,
      max: 53,
      interval: 4,
      name: "Season week",
      nameLocation: "middle",
      nameGap: 28,
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
        data: points.map((p) => [p.week, p.cumulative]),
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
        data: points.map((p) => [p.week, p.rolling4wk]),
      },
    ],
  });

  const breakdownCharts: Array<{ resize: () => void }> = [];
  const mountHorizontal = (
    el: HTMLElement | null,
    values: Array<{ label: string; count: number }>,
    color: string,
  ) => {
    if (!el) return;
    if (values.length === 0) {
      el.textContent = "No data available";
      return;
    }
    const chart = echarts.init(el, undefined, { renderer: "canvas" });
    chart.setOption({
      backgroundColor: "transparent",
      textStyle: { color: MUTED, fontFamily: "Inter, system-ui, sans-serif" },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#ffffff",
        borderColor: "#cbd5e1",
        textStyle: { color: INK, fontSize: 12 },
      },
      grid: { left: 8, right: 28, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: MUTED, fontSize: 11 },
        splitLine: { lineStyle: { color: LINE } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: values.map((value) => value.label),
        axisLabel: { color: MUTED, fontSize: 11, width: 150, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [{
        type: "bar",
        data: values.map((value) => value.count),
        barMaxWidth: 22,
        itemStyle: { color, borderRadius: [0, 3, 3, 0] },
        label: { show: true, position: "right", color: INK, fontSize: 11 },
      }],
    });
    breakdownCharts.push(chart);
  };

  mountHorizontal(breakdownEls.jobTypes, summary.jobTypes, ACCENT);
  mountHorizontal(breakdownEls.regions, summary.regions, "#2563eb");
  mountHorizontal(
    breakdownEls.jel,
    summary.jel.map((item) => ({ label: item.code, count: item.count })),
    "#7c3aed",
  );

  if (breakdownEls.deadlines) {
    const deadlineChart = echarts.init(breakdownEls.deadlines, undefined, { renderer: "canvas" });
    const deadlineLabels = summary.deadlines.map((item) => {
      const [year, month] = item.month.split("-").map(Number);
      return new Date(Date.UTC(year!, month! - 1, 1)).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      });
    });
    deadlineChart.setOption({
      backgroundColor: "transparent",
      textStyle: { color: MUTED, fontFamily: "Inter, system-ui, sans-serif" },
      tooltip: { trigger: "axis", backgroundColor: "#ffffff", borderColor: "#cbd5e1", textStyle: { color: INK, fontSize: 12 } },
      grid: { left: 8, right: 12, top: 12, bottom: 28, containLabel: true },
      xAxis: { type: "category", data: deadlineLabels, axisLabel: { color: MUTED, fontSize: 10, rotate: 35 }, axisLine: { lineStyle: { color: LINE } }, axisTick: { show: false } },
      yAxis: { type: "value", minInterval: 1, axisLabel: { color: MUTED, fontSize: 11 }, splitLine: { lineStyle: { color: LINE } } },
      series: [{ type: "bar", data: summary.deadlines.map((item) => item.count), barMaxWidth: 24, itemStyle: { color: "#d97706", borderRadius: [3, 3, 0, 0] } }],
    });
    breakdownCharts.push(deadlineChart);
  }

  window.addEventListener("resize", () => {
    cum.resize();
    roll.resize();
    for (const chart of breakdownCharts) chart.resize();
  });
}
