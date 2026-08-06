import { describe, expect, it } from "vitest";
import { adjustedWeek, academicYearFor, buildWeeklySeries } from "./weeks";

describe("weeks", () => {
  it("maps ISO week 31 to adjusted week 1", () => {
    expect(adjustedWeek(31)).toBe(1);
    expect(adjustedWeek(32)).toBe(2);
    expect(adjustedWeek(1)).toBe(23); // 1 + (52-31+1) = 23
  });

  it("assigns academic year by start week", () => {
    // 2026-01-15 is week ~3 → academic year 2025
    expect(academicYearFor(new Date("2026-01-15T12:00:00Z"))).toBe(2025);
    // 2026-08-10 is week ~33 → academic year 2026
    expect(academicYearFor(new Date("2026-08-10T12:00:00Z"))).toBe(2026);
  });

  it("builds cumulative series", () => {
    const points = buildWeeklySeries([
      { year: 2025, week: 1, count: 10 },
      { year: 2025, week: 2, count: 5 },
      { year: 2025, week: 3, count: 5 },
    ]);
    expect(points.map((p) => p.cumulative)).toEqual([10, 15, 20]);
    expect(points[2]!.rolling4wk).toBe(20);
  });
});
