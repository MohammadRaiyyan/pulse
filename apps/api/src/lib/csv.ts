export type CsvValue = string | number | null;

const NEEDS_QUOTES = /[",\r\n]/;

const FORMULA_START = /^[=+\-@\t\r]/;

export const neutralizeFormula = (text: string) =>
  FORMULA_START.test(text) ? `'${text}` : text;

const formatField = (value: CsvValue) => {
  if (value === null) {
    return "";
  }

  const text = String(value);

  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const toCsv = (rows: readonly (readonly CsvValue[])[]) =>
  rows.map((row) => row.map(formatField).join(",")).join("\r\n") + "\r\n";
