import { describe, expect, it } from "vitest";
import { parseJoeXml } from "./parse-xml";

const SAMPLE = `<?xml version="1.0"?>
<JOE_EXPORT>
<year joe_year_ID="2026">
<issue joe_issue_ID="2">
	<position jp_id="111477553">
		<jp_section>US: Full-Time Academic (Permanent, Tenure Track or Tenured)</jp_section>
		<jp_title>Economics Faculty CFS Professorial</jp_title>
		<jp_institution>Brigham Young University</jp_institution>
		<jp_division></jp_division>
		<jp_department>Economics</jp_department>
		<jp_salary_range></jp_salary_range>
		<jp_agency_insertion_num></jp_agency_insertion_num>
		<jp_application_deadline>2026-09-09 00:00:00</jp_application_deadline>
		<jp_full_text>Apply please</jp_full_text>
		<jp_keywords></jp_keywords>
		<jp_status>Active</jp_status>
		<jp_new>1</jp_new>
		<locations>
			<location>
				<country>UNITED STATES</country>
				<state>Utah</state>
				<city>Provo</city>
			</location>
		</locations>
		<JEL_Classifications>
			<jel_class>
				<jc_code>A</jc_code>
				<jc_description>General Economics</jc_description>
			</jel_class>
		</JEL_Classifications>
	</position>
</issue>
</year>
</JOE_EXPORT>`;

describe("parseJoeXml", () => {
  it("parses nested year/issue/position", () => {
    const listings = parseJoeXml(SAMPLE);
    expect(listings).toHaveLength(1);
    expect(listings[0]!.jpId).toBe(111477553);
    expect(listings[0]!.joeYear).toBe(2026);
    expect(listings[0]!.institution).toBe("Brigham Young University");
    expect(listings[0]!.applicationDeadline).toBe("2026-09-09");
    expect(listings[0]!.locations[0]).toEqual({
      country: "UNITED STATES",
      state: "Utah",
      city: "Provo",
    });
    expect(listings[0]!.jel[0]!.code).toBe("A");
  });
});
