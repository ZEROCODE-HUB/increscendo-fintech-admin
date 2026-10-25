import { useEffect, useState } from "react";

/** Debounce de un valor (p. ej. texto libre de búsqueda) para no disparar una query por tecla. */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
