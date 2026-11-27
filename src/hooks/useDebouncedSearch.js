import { useEffect, useRef, useState } from "react";

export function useDebouncedSearch(value, onCommit) {
  const normalized = String(value || "").trim();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (normalized.length < 2) {
      setDebouncedSearch("");
      onCommitRef.current?.();
      return;
    }

    const timeout = window.setTimeout(() => {
      setDebouncedSearch(normalized);
      onCommitRef.current?.();
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [normalized]);

  return debouncedSearch;
}
