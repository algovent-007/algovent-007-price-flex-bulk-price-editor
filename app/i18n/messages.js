import en from "../../locales/en.json";
import cs from "../../locales/cs.json";
import da from "../../locales/da.json";
import nl from "../../locales/nl.json";
import fi from "../../locales/fi.json";
import fr from "../../locales/fr.json";
import de from "../../locales/de.json";
import it from "../../locales/it.json";
import ko from "../../locales/ko.json";
import nb from "../../locales/nb.json";
import pl from "../../locales/pl.json";
import ptBR from "../../locales/pt-BR.json";
import ptPT from "../../locales/pt-PT.json";
import es from "../../locales/es.json";
import sv from "../../locales/sv.json";
import tr from "../../locales/tr.json";
import zhCN from "../../locales/zh-CN.json";
import zhTW from "../../locales/zh-TW.json";
import ja from "../../locales/ja.json";
import th from "../../locales/th.json";
import { DEFAULT_LOCALE } from "./locales.js";

export const MESSAGE_CATALOG = {
  en,
  cs,
  da,
  nl,
  fi,
  fr,
  de,
  it,
  ko,
  nb,
  pl,
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  es,
  sv,
  tr,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  th,
};

export function getMessages(locale) {
  return MESSAGE_CATALOG[locale] || MESSAGE_CATALOG[DEFAULT_LOCALE];
}

export function getFallbackMessages() {
  return MESSAGE_CATALOG[DEFAULT_LOCALE];
}
