import { describe, it, expect } from "vitest";
import { chaseStreamValue } from "./stream-display";

const FRAME = 1 / 60;

/** Run `seconds` of 60fps frames against a moving anchor trajectory. */
function run(
  display: number,
  start: number,
  perSecond: number,
  seconds: number,
) {
  const values: number[] = [];
  for (let i = 1; i <= seconds * 60; i++) {
    const target = start + i * FRAME * perSecond;
    display = chaseStreamValue(display, target, perSecond, FRAME);
    values.push(display);
  }
  return { display, values };
}

describe("chaseStreamValue", () => {
  it("glides up to a slightly higher anchor without jumping", () => {
    const start = 100;
    const { display, values } = run(98, start, 1, 2);
    // Converged close to the trajectory (within the small steady-state lag)…
    expect(display).toBeGreaterThan(start + 2 - 1);
    // …monotonically, with no single-frame jump.
    values.reduce((prev, v) => {
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v - prev).toBeLessThan(0.2);
      return v;
    }, 98);
  });

  it("holds (never runs backward) when ahead of an upward anchor", () => {
    const { values } = run(102, 100, 1, 3);
    values.reduce((prev, v) => {
      expect(v).toBeGreaterThanOrEqual(prev);
      return v;
    }, 102);
    // The growing anchor eventually catches up and the count resumes rising.
    expect(values[values.length - 1]).toBeGreaterThan(102);
  });

  it("snaps on a regime change (pot drained)", () => {
    expect(chaseStreamValue(1e-11, 1e-15, 0, FRAME)).toBe(1e-15);
    expect(chaseStreamValue(5, 100, 1, FRAME)).toBe(100);
  });

  it("ticks at the stream rate in steady state", () => {
    const { values } = run(100, 100, 2, 3);
    const lastSecond = values.slice(-60);
    const rate = (lastSecond[59] - lastSecond[0]) / (59 * FRAME);
    expect(rate).toBeCloseTo(2, 1);
  });

  it("glides down for negative streams", () => {
    const { display, values } = run(100, 100, -1, 2);
    expect(display).toBeLessThan(99);
    values.reduce((prev, v) => {
      expect(v).toBeLessThanOrEqual(prev);
      return v;
    }, 100);
  });
});
