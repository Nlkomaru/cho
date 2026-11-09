import { expect, test } from "vite-plus/test";
import { formatCostRange, formatMissingCost } from "./format";

test("cost shows a plain amount when complete, a lower bound when partial, and a dash when unpriced", () => {
  expect(formatCostRange(320, 0)).toBe("¥320");
  expect(formatCostRange(320)).toBe("¥320");
  expect(formatCostRange(320, 2)).toBe("¥320〜");
  expect(formatCostRange(null, 3)).toBe("—");
});

test("missing-price note is only shown when something is unpriced", () => {
  expect(formatMissingCost(0)).toBeNull();
  expect(formatMissingCost(2)).toBe("2品未登録");
});
