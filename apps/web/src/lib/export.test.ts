import { beforeEach, expect, it, vi } from "vitest";
import { listAllByMark, type ListingWithRelations } from "@joe/db";
import { GET } from "../pages/api/export";

vi.mock("@joe/db", () => ({ listAllByMark: vi.fn() }));
vi.mock("./db", () => ({ getDb: () => ({}) }));

beforeEach(() => vi.clearAllMocks());

it("exports first review as Priority Deadline and leaves unknown review dates blank", async () => {
  vi.mocked(listAllByMark).mockResolvedValue([
    {
      jpId: 1,
      institution: "Example",
      title: "Economist",
      applicationDeadline: "2026-12-01",
      reviewDate: "2026-10-15",
      dateActive: "2026-09-01",
      mark: { state: "interested" },
    },
    {
      jpId: 2,
      institution: "Other",
      title: "Economist",
      applicationDeadline: "2026-11-01",
      reviewDate: null,
      dateActive: "2026-08-01",
      mark: { state: "interested" },
    },
  ] as ListingWithRelations[]);
  const response = await GET({
    url: new URL("http://localhost/api/export?state=interested"),
  } as Parameters<typeof GET>[0]);
  const lines = (await response.text()).replace(/^\uFEFF/, "").split("\r\n");
  expect(lines[0]).toContain('"Deadline","Priority Deadline","Applied?"');
  expect(lines[1]).toContain('"12/1/26","10/15/26",""');
  expect(lines[2]).toContain('"11/1/26","",""');
});

it("supports exporting Maybe only and rejects unknown groups", async () => {
  vi.mocked(listAllByMark).mockResolvedValue([]);
  const response = await GET({
    url: new URL("http://localhost/api/export?state=maybe"),
  } as Parameters<typeof GET>[0]);
  expect(response.status).toBe(200);
  expect(listAllByMark).toHaveBeenCalledWith({}, "maybe");
  const invalid = await GET({
    url: new URL("http://localhost/api/export?state=unknown"),
  } as Parameters<typeof GET>[0]);
  expect(invalid.status).toBe(400);
});
