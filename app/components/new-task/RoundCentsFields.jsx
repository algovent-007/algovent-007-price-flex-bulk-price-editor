import { createNumericInputHandlers } from "../../utils/numeric-input";

export default function RoundCentsFields({
  roundCents,
  roundCentsDigit,
  setRoundCents,
  setRoundCentsDigit,
  readOnly = false,
  fieldError,
  clearFieldError,
  errorKey = "roundCentsDigit",
}) {
  const showDigitField = roundCents === "2" || roundCents === "9";
  const digitLabel =
    roundCents === "9" ? "Ending digits" : roundCents === "2" ? "Decimal places" : "";
  const digitPlaceholder = roundCents === "9" ? "99" : "2";
  const numericFieldProps = createNumericInputHandlers(clearFieldError);

  return (
    <>
      <s-select
        label="Round off cents"
        value={roundCents}
        disabled={readOnly}
        onInput={
          readOnly
            ? undefined
            : (e) => {
                const value = e.target.value;
                setRoundCents(value);
                if (value === "9" && !roundCentsDigit) {
                  setRoundCentsDigit("99");
                } else if (value === "2" && !roundCentsDigit) {
                  setRoundCentsDigit("2");
                }
              }
        }
      >
        <s-option value="1">No</s-option>
        <s-option value="2">Fixed Round Off</s-option>
        <s-option value="3">Nearest Integer</s-option>
        <s-option value="4">Nearest Integer Up</s-option>
        <s-option value="5">Nearest Integer Down</s-option>
        <s-option value="6">Nearest 5 Cent</s-option>
        <s-option value="7">Nearest 5 Cent Up</s-option>
        <s-option value="8">Nearest 5 Cent Down</s-option>
        <s-option value="9">End prices in a certain number</s-option>
      </s-select>

      {showDigitField && (
        <s-box paddingBlockStart="small">
          <s-text-field
            label={digitLabel}
            value={roundCentsDigit}
            placeholder={digitPlaceholder}
            inputMode="numeric"
            disabled={readOnly}
            {...numericFieldProps(setRoundCentsDigit, errorKey)}
            error={fieldError?.(errorKey)}
          ></s-text-field>
          {roundCents === "9" && (
            <s-text color="subdued">Example: enter 99 to end prices in .99</s-text>
          )}
        </s-box>
      )}
    </>
  );
}
