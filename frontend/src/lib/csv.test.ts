import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes separators and neutralises spreadsheet formulas, but keeps negative numbers", () => {
    const csv = toCsv(
      [
        { label: "name", value: (r: { name: string; v: number | null }) => r.name },
        { label: "value", value: (r: { name: string; v: number | null }) => r.v },
      ],
      [
        { name: 'a, "b"', v: -1.5 },
        { name: "=SUM(A1)", v: null },
        { name: "-12", v: 3 },
      ],
    );
    expect(csv.split("\r\n")).toEqual(["name,value", '"a, ""b""",-1.5', "'=SUM(A1),", "-12,3", ""]);
  });
});
