import { describe, expect, it } from "vitest";
import { contentHash, type NormalizedListing } from "@joe/core";

function sample(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    jpId: 111477553,
    joeYear: 2026,
    joeIssueId: 2,
    section: "US: Full-Time Academic (Permanent, Tenure Track or Tenured)",
    title: "Economics Faculty",
    institution: "Brigham Young University",
    division: null,
    department: "Economics",
    salaryRange: null,
    keywords: null,
    fullText: "Apply now",
    applicationDeadline: "2026-09-09",
    status: "Active",
    dateActive: "2026-08-01",
    locations: [{ country: "UNITED STATES", state: "Utah", city: "Provo" }],
    jel: [{ code: "A", description: "General Economics" }],
    ...overrides,
  };
}

describe("contentHash idempotency", () => {
  it("is stable for identical content", async () => {
    const a = await contentHash(sample());
    const b = await contentHash(sample());
    expect(a).toBe(b);
  });

  it("changes when title changes", async () => {
    const a = await contentHash(sample());
    const b = await contentHash(sample({ title: "Different title" }));
    expect(a).not.toBe(b);
  });
});
