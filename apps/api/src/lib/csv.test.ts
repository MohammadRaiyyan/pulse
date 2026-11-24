import { describe, expect, it } from "vitest";
import { neutralizeFormula, toCsv } from "./csv.ts";

describe("toCsv", () => {
  it("joins fields with commas and ends every record with CRLF", () => {
    expect(
      toCsv([
        ["a", "b"],
        [1, null],
      ]),
    ).toBe("a,b\r\n1,\r\n");
  });

  it("quotes fields with commas, quotes and line breaks and doubles inner quotes", () => {
    expect(
      toCsv([["x,y", 'say "hi"', "two\nlines", "cr\rhere", "plain"]]),
    ).toBe('"x,y","say ""hi""","two\nlines","cr\rhere",plain\r\n');
  });

  it("prefixes text that a spreadsheet would run as a formula", () => {
    expect(neutralizeFormula("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(neutralizeFormula("+1")).toBe("'+1");
    expect(neutralizeFormula("-1")).toBe("'-1");
    expect(neutralizeFormula("@cmd")).toBe("'@cmd");
    expect(neutralizeFormula("Checkout API")).toBe("Checkout API");
  });
});
