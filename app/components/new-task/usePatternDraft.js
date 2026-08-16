import { useEffect, useRef, useState } from "react";
import { normalizeEndingPattern } from "../../utils/ending-price-pattern";

export function usePatternDraft(pattern, defaultPattern, serializePattern) {
  const normalize = (value) => normalizeEndingPattern(value ?? defaultPattern);
  const [draft, setDraft] = useState(() => normalize(pattern));
  const lastEmittedRef = useRef(serializePattern(normalize(pattern)));

  useEffect(() => {
    const incoming = serializePattern(normalize(pattern));
    if (incoming !== lastEmittedRef.current) {
      lastEmittedRef.current = incoming;
      setDraft(normalize(pattern));
    }
  }, [pattern, defaultPattern, serializePattern]);

  const commitPattern = (nextPattern, onPatternChange) => {
    const normalized = normalize(nextPattern);
    const serialized = serializePattern(normalized);
    lastEmittedRef.current = serialized;
    setDraft(normalized);
    onPatternChange?.(normalized);
  };

  return { draft, commitPattern };
}
