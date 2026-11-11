// A number typed the language's way, read back as a plain number: "١٬٢٣٤٫٥" in Arabic or
// "1,234.5" in English are both 1234.5. Intl formats numbers but has no parser, so this reads the
// language's own digits and separators from Intl.NumberFormat's formatToParts and undoes them.
export function parseNumber(locale: string, text: string): number {
  const format = new Intl.NumberFormat(locale);
  const parts = format.formatToParts(-12345.6);
  const symbol = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // The language's digits 0-9, in order: "9876543210" formatted, read backwards.
  const nine = new Intl.NumberFormat(locale, { useGrouping: false }).format(9876543210);
  const digits = [...new Intl.Segmenter(locale).segment(nine)].map((s) => s.segment).reverse();
  let plain = "";
  for (const ch of text.replace(/[‎‏؜\s]/g, "")) {
    const digit = digits.indexOf(ch);
    if (digit >= 0) plain += digit;
    else if (/[0-9]/.test(ch)) plain += ch;
    else if (ch === symbol("decimal")) plain += ".";
    else if (ch === symbol("minusSign") || ch === "-" || ch === "−") plain += "-";
    else if (ch === symbol("group") || ch === "," || ch === "." || ch === " " || ch === "'")
      continue;
    else return NaN;
  }
  return plain === "" ? NaN : Number(plain);
}
