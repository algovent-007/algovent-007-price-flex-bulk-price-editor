import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, matchSupportedLocale } from "./locales.js";
import { resolveLocale } from "./resolve-locale.js";
import { formatCurrency, formatNumber, translate } from "./translate.js";
import { ERROR_MESSAGE_KEYS, translateError } from "./errors.js";

const REQUIRED_TEST_LOCALES = ["en", "fr", "de", "es", "pt-BR", "zh-CN", "ja", "th", "ko"];
const localesDir = join(dirname(fileURLToPath(import.meta.url)), "../../locales");

function loadMessages(locale) {
  return JSON.parse(readFileSync(join(localesDir, `${locale}.json`), "utf8"));
}

function getFallbackMessages() {
  return loadMessages(DEFAULT_LOCALE);
}

function getMessages(locale) {
  return loadMessages(locale);
}

function flattenKeys(source, prefix = "") {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !("one" in value || "other" in value)) {
      return flattenKeys(value, path);
    }
    return [path];
  });
}

{
  assert.equal(SUPPORTED_LOCALES[0].code, "en");
  assert.equal(SUPPORTED_LOCALES[0].name, "English");
  assert.deepEqual(
    SUPPORTED_LOCALES.map((locale) => locale.code),
    [
      "en",
      "cs",
      "da",
      "nl",
      "fi",
      "fr",
      "de",
      "it",
      "ko",
      "nb",
      "pl",
      "pt-BR",
      "pt-PT",
      "es",
      "sv",
      "tr",
      "zh-CN",
      "zh-TW",
      "ja",
      "th",
    ],
  );
  for (const locale of SUPPORTED_LOCALES) {
    assert.ok(locale.direction === "ltr" || locale.direction === "rtl");
    assert.ok(loadMessages(locale.code), `missing catalog for ${locale.code}`);
  }
}

{
  assert.equal(matchSupportedLocale("fr-CA"), "fr");
  assert.equal(matchSupportedLocale("pt-BR"), "pt-BR");
  assert.equal(matchSupportedLocale("pt"), "pt-BR");
  assert.equal(matchSupportedLocale("zh-Hans"), "zh-CN");
  assert.equal(matchSupportedLocale("zh-Hant"), "zh-TW");
  assert.equal(matchSupportedLocale("no"), "nb");
  assert.equal(matchSupportedLocale("en-US"), "en");
  assert.equal(matchSupportedLocale("unsupported"), null);
}

{
  assert.equal(resolveLocale({ savedLocale: "de", shopifyLocale: "fr" }), "de");
  assert.equal(resolveLocale({ savedLocale: null, shopifyLocale: "ja" }), "ja");
  assert.equal(resolveLocale({}), DEFAULT_LOCALE);
}

{
  const en = getFallbackMessages();
  const fr = getMessages("fr");
  assert.equal(translate(fr, en, "nav.currentTasks", {}, "fr"), fr.nav.currentTasks);
  assert.equal(
    translate({ nav: {} }, en, "nav.currentTasks", {}, "fr"),
    en.nav.currentTasks,
  );
  assert.equal(translate(fr, en, "does.not.exist", {}, "fr"), "");
  assert.notEqual(translate(fr, en, "does.not.exist", {}, "fr"), "does.not.exist");
}

{
  const en = getFallbackMessages();
  assert.equal(
    translate(en, en, "newTask.executed", { name: "Summer sale", products: 25, variants: 1 }, "en"),
    'Successfully executed task "Summer sale". Updated 25 products and 1 variants.',
  );
  assert.equal(
    translate(en, en, "progress.unit.products", { count: 1 }, "en"),
    "product",
  );
  assert.equal(
    translate(en, en, "progress.unit.products", { count: 25 }, "en"),
    "products",
  );
  assert.equal(
    translate(en, en, "history.variantCount", { count: 1 }, "en"),
    "1 variant",
  );
  assert.equal(
    translate(en, en, "history.variantCount", { count: 25 }, "en"),
    "25 variants",
  );
}

{
  assert.ok(formatNumber(25, "fr").includes("25"));
  assert.ok(formatCurrency(12.5, "en", "USD").includes("12"));
}

{
  const t = (key) => translate(getMessages("fr"), getFallbackMessages(), key, {}, "fr");
  assert.equal(translateError(t, "Enter a task name."), t("errors.taskName"));
  assert.equal(
    translateError(t, "No changes to roll back"),
    t("history.errors.noChanges"),
  );
  assert.equal(translateError(t, "Some unknown server error"), "Some unknown server error");
  assert.ok(Object.keys(ERROR_MESSAGE_KEYS).length > 10);
}

{
  const englishKeys = flattenKeys(getFallbackMessages());
  for (const locale of REQUIRED_TEST_LOCALES) {
    const keys = flattenKeys(getMessages(locale));
    for (const key of englishKeys) {
      assert.ok(keys.includes(key), `${locale} is missing key ${key}`);
    }
  }
}

{
  const en = getFallbackMessages();
  for (const locale of ["fr", "de", "es", "pt-BR", "zh-CN", "ja", "th", "ko"]) {
    const messages = getMessages(locale);
    assert.notEqual(messages.nav.newTask, en.nav.newTask, `${locale} nav.newTask should be translated`);
    assert.notEqual(messages.language.label, en.language.label, `${locale} language.label should be translated`);
  }
}

console.log("All i18n tests passed.");
