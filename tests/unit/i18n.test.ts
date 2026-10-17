import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatYearIn, translate } from "@/lib/i18n";
import { ZH } from "@/lib/i18n-zh";
import { CategorySchema, ErasSchema } from "@/lib/data/schemas";
import erasJson from "@/data/eras.json";
import { computeBadges, EMPTY_DISCOVERY } from "@/lib/domain/discovery";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    const p = path.join(dir, f.name);
    return f.isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

describe("i18n", () => {
  it("has a Chinese string for every t(\"…\") literal in the components", () => {
    const keys = new Set<string>();
    for (const file of sourceFiles(path.join(process.cwd(), "src/components"))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(m[1]!);
    }
    // Help-overlay descriptions are translated through t(v).
    const help = readFileSync(path.join(process.cwd(), "src/components/app/help-overlay.tsx"), "utf8");
    for (const m of help.matchAll(/\[\s*"[^"]*",\s*"([^"]*)"\s*\]/g)) keys.add(m[1]!);
    expect(keys.size).toBeGreaterThan(50);
    expect([...keys].filter((k) => !(k in ZH))).toEqual([]);
  });

  it("translates the data-driven labels: categories, eras, badges, story headings", () => {
    const labels = [
      ...CategorySchema.options,
      ...ErasSchema.parse(erasJson).map((e) => e.name),
      ...computeBadges(EMPTY_DISCOVERY, []).flatMap((b) => [b.name, b.description]),
      "The two sides", "Meanwhile, elsewhere", "The wider view", "Span", "Year", "Theme", "Significance", "Belligerents",
    ];
    expect(labels.filter((k) => !(k in ZH))).toEqual([]);
  });

  it("interpolates and falls back to English", () => {
    expect(translate("zh", "borders of {year}", { year: "1945年" })).toBe("1945年的边界");
    expect(translate("en", "borders of {year}", { year: 1945 })).toBe("borders of 1945");
    expect(translate("zh", "Some untranslated event title")).toBe("Some untranslated event title");
  });

  it("formats years per language", () => {
    expect(formatYearIn("en", -500)).toBe("500 BC");
    expect(formatYearIn("en", 79)).toBe("AD 79");
    expect(formatYearIn("zh", -500)).toBe("公元前500年");
    expect(formatYearIn("zh", 1453)).toBe("1453年");
  });
});
