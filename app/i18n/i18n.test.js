import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, matchSupportedLocale } from "./locales.js";
import { resolveLocale } from "./resolve-locale.js";
import { formatCurrency, formatNumber, translate } from "./translate.js";
import { ERROR_MESSAGE_KEYS, translateError } from "./errors.js";

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
    translateError(
      t,
      "You can run up to 3 tasks at the same time. Wait for one to finish before starting another.",
    ),
    t("errors.concurrentLimit"),
  );
  assert.equal(
    translateError(t, "Task stopped because it was interrupted."),
    t("errors.interrupted"),
  );
  assert.equal(
    translateError(t, "Failed to create task."),
    t("errors.createFailed"),
  );
  assert.equal(
    translateError(t, "No changes to roll back"),
    t("history.errors.noChanges"),
  );
  assert.equal(translateError(t, "Some unknown server error"), "Some unknown server error");
  assert.ok(Object.keys(ERROR_MESSAGE_KEYS).length > 10);
}

{
  const englishKeys = flattenKeys(getFallbackMessages());
  for (const locale of SUPPORTED_LOCALES.map((item) => item.code)) {
    const keys = flattenKeys(getMessages(locale));
    for (const key of englishKeys) {
      assert.ok(keys.includes(key), `${locale} is missing key ${key}`);
    }
  }
}

{
  const en = getFallbackMessages();
  for (const key of Object.values(ERROR_MESSAGE_KEYS)) {
    assert.ok(flattenKeys(en).includes(key), `ERROR_MESSAGE_KEYS points to missing ${key}`);
  }
}

{
  const en = getFallbackMessages();
  const translatedLocales = SUPPORTED_LOCALES.map((item) => item.code).filter((code) => code !== DEFAULT_LOCALE);
  const requiredTranslatedKeys = [
    "nav.currentTasks",
    "nav.newTask",
    "nav.scheduledTasks",
    "nav.tasksHistory",
    "language.label",
    "language.selectorAria",
    "home.heading",
    "home.howToTitle",
    "home.lastCompletedTask",
    "common.cancel",
    "common.close",
    "common.loading",
    "progress.title",
    "errors.taskName",
    "errors.interrupted",
    "errors.createFailed",
  ];

  function valueAt(source, path) {
    return path.split(".").reduce((current, segment) => current?.[segment], source);
  }

  for (const locale of translatedLocales) {
    const messages = getMessages(locale);
    for (const key of requiredTranslatedKeys) {
      const translated = valueAt(messages, key);
      const english = valueAt(en, key);
      assert.ok(translated, `${locale} is missing ${key}`);
      assert.notEqual(translated, english, `${locale} ${key} should be translated`);
    }
  }
}

console.log("All i18n tests passed.");
