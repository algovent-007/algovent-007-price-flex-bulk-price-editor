import { SUPPORTED_LOCALES } from "../i18n/locales";
import { useI18n } from "../i18n/I18nProvider";

export default function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();

  const handleChange = (event) => {
    const next = event.currentTarget?.value ?? event.target?.value;
    if (next) setLocale(next);
  };

  return (
    <s-select
      label={t("language.label")}
      labelAccessibilityVisibility="exclusive"
      accessibilityLabel={t("language.selectorAria")}
      value={locale}
      onInput={handleChange}
      onChange={handleChange}
    >
      {SUPPORTED_LOCALES.map((option) => (
        <s-option key={option.code} value={option.code}>
          {option.name}
        </s-option>
      ))}
    </s-select>
  );
}
