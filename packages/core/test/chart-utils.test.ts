import { describe, it, expect } from "vitest";
import {
  getChartBounds,
  buildLinePoints,
  buildLinePath,
  buildAreaPath,
  buildDonutSegments,
  formatChartValue,
} from "../src/chart-utils.js";

describe("getChartBounds", () => {
  it("returns default bounds for empty values", () => {
    expect(getChartBounds([])).toEqual({ min: 0, max: 1, range: 1 });
  });

  it("computes min/max/range from values", () => {
    const b = getChartBounds([10, 20, 30]);
    expect(b.min).toBe(10);
    expect(b.max).toBe(30);
    expect(b.range).toBe(20);
  });

  it("adds padding when min equals max", () => {
    const b = getChartBounds([5, 5, 5]);
    expect(b.min).toBeLessThan(5);
    expect(b.max).toBeGreaterThan(5);
    expect(b.range).toBeGreaterThan(0);
  });

  it("handles min=max=0", () => {
    const b = getChartBounds([0]);
    expect(b).toEqual({ min: -1, max: 1, range: 2 });
  });

  it("respects explicit min/max", () => {
    const b = getChartBounds([10, 20], 0, 50);
    expect(b.min).toBe(0);
    expect(b.max).toBe(50);
    expect(b.range).toBe(50);
  });

  it("filters non-finite values", () => {
    const b = getChartBounds([NaN, 10, Infinity, 20, -Infinity]);
    expect(b.min).toBe(10);
    expect(b.max).toBe(20);
  });
});

describe("buildLinePoints", () => {
  it("returns empty array for empty values", () => {
    expect(buildLinePoints([], 100, 100, 10)).toEqual([]);
  });

  it("builds points for single value", () => {
    const pts = buildLinePoints([50], 200, 100, 10);
    expect(pts).toHaveLength(1);
    expect(pts[0].x).toBe(100); // centered
  });

  it("builds points for multiple values", () => {
    const pts = buildLinePoints([0, 100], 200, 100, 10);
    expect(pts).toHaveLength(2);
    expect(pts[0].x).toBe(10); // left padding
    expect(pts[1].x).toBe(190); // right padding
  });
});

describe("buildLinePath", () => {
  it("returns empty string for no points", () => {
    expect(buildLinePath([])).toBe("");
  });

  it("builds M/L path from points", () => {
    const path = buildLinePath([{ x: 10, y: 20 }, { x: 30, y: 40 }]);
    expect(path).toBe("M 10 20 L 30 40");
  });
});

describe("buildAreaPath", () => {
  it("returns empty string for no points", () => {
    expect(buildAreaPath([], 100, 10)).toBe("");
  });

  it("closes path to baseline", () => {
    const path = buildAreaPath([{ x: 10, y: 20 }, { x: 50, y: 30 }], 100, 10);
    expect(path).toContain("M 10 20");
    expect(path).toContain("L 50 30");
    expect(path).toContain("Z");
  });
});

describe("buildDonutSegments", () => {
  it("computes segments with percentages", () => {
    const segs = buildDonutSegments([
      { label: "A", value: 75 },
      { label: "B", value: 25 },
    ], 100);
    expect(segs).toHaveLength(2);
    expect(segs[0].percentage).toBeCloseTo(0.75);
    expect(segs[1].percentage).toBeCloseTo(0.25);
    expect(segs[0].dashLength).toBeCloseTo(75);
    expect(segs[1].dashLength).toBeCloseTo(25);
  });

  it("handles all-zero values", () => {
    const segs = buildDonutSegments([{ label: "A", value: 0 }], 100);
    expect(segs[0].percentage).toBe(0);
  });

  it("clamps negative values to 0", () => {
    const segs = buildDonutSegments([
      { label: "A", value: -10 },
      { label: "B", value: 100 },
    ], 100);
    expect(segs[0].percentage).toBe(0);
    expect(segs[1].percentage).toBe(1);
  });
});

describe("formatChartValue", () => {
  it("formats billions", () => {
    expect(formatChartValue(2_500_000_000)).toBe("2.5B");
  });

  it("formats millions", () => {
    expect(formatChartValue(1_200_000)).toBe("1.2M");
  });

  it("formats thousands", () => {
    expect(formatChartValue(3_500)).toBe("3.5K");
  });

  it("formats integers", () => {
    expect(formatChartValue(42)).toBe("42");
  });

  it("formats decimals to 2 places", () => {
    expect(formatChartValue(3.14159)).toBe("3.14");
  });

  it("applies prefix and suffix", () => {
    expect(formatChartValue(1000, "$", " USD")).toBe("$1.0K USD");
  });

  it("handles null prefix/suffix", () => {
    expect(formatChartValue(100, null, null)).toBe("100");
  });
});
