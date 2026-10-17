import { describe, expect, it } from "vitest";

function level(score: number) {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

describe("risk level boundaries", () => {
  it("maps scores consistently", () => {
    expect(level(0)).toBe("Low");
    expect(level(24)).toBe("Low");
    expect(level(25)).toBe("Medium");
    expect(level(49)).toBe("Medium");
    expect(level(50)).toBe("High");
    expect(level(74)).toBe("High");
    expect(level(75)).toBe("Critical");
    expect(level(100)).toBe("Critical");
  });
});
