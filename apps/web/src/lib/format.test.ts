import { describe, expect, it } from "vitest";
import { keywordLabel, locationLabel } from "./format";

describe("listing metadata", () => {
  it("displays every location, keeping each place distinct", () => {
    expect(
      locationLabel({
        locations: [
          { jpId: 1, country: "Canada", state: "Ontario", city: "" },
          {
            jpId: 1,
            country: "United States",
            state: "California",
            city: "San Francisco",
          },
          {
            jpId: 1,
            country: "United States",
            state: "New York",
            city: "New York",
          },
        ],
      }),
    ).toBe(
      "Ontario, Canada; San Francisco, California, United States; New York, New York, United States",
    );
    expect(locationLabel({ locations: [] })).toBeNull();
  });

  it("separates newline keywords with commas without splitting phrases", () => {
    expect(keywordLabel("Health\r\nEconometrics\r\n\r\nPublic Policy")).toBe(
      "Health, Econometrics, Public Policy",
    );
    expect(keywordLabel("Trade,\nFinance;\nApplied microeconomics")).toBe(
      "Trade, Finance, Applied microeconomics",
    );
    expect(keywordLabel("Insurance and Risk Management")).toBe(
      "Insurance and Risk Management",
    );
    expect(keywordLabel(null)).toBeNull();
  });
});
