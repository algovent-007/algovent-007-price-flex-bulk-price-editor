import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROWS as BASE_ROWS } from "./i18n-glossary-rows.mjs";
import { REST_ROWS } from "./i18n-glossary-rows-rest.mjs";
import { TASK_ROWS } from "./i18n-glossary-rows-task.mjs";
import { MORE_ROWS } from "./i18n-glossary-rows-more.mjs";

const ROWS = [...BASE_ROWS, ...REST_ROWS, ...TASK_ROWS, ...MORE_ROWS];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = ["fr", "de", "es", "pt-BR", "zh-CN", "ja", "th", "ko"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyMap(value, map) {
  if (typeof value === "string") {
    return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyMap(item, map));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, applyMap(nested, map)]),
    );
  }
  return value;
}

const english = JSON.parse(readFileSync(join(root, "locales/en.json"), "utf8"));
const maps = Object.fromEntries(LOCALES.map((locale) => [locale, {}]));

for (const row of ROWS) {
  if (row.length !== LOCALES.length + 1) {
    throw new Error(`Glossary row for "${row[0]}" has ${row.length} columns, expected ${LOCALES.length + 1}`);
  }
  const [source, ...translations] = row;
  LOCALES.forEach((locale, index) => {
    maps[locale][source] = translations[index];
  });
}

for (const locale of LOCALES) {
  const translated = applyMap(clone(english), maps[locale]);
  writeFileSync(join(root, `locales/${locale}.json`), `${JSON.stringify(translated, null, 2)}\n`);
}

console.log(`Applied glossaries to ${LOCALES.join(", ")}`);
