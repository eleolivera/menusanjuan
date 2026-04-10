"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type FieldStatus = "idle" | "saving" | "saved" | "error";
type SaveTier = "instant" | "autosave" | "explicit";

type UseSmartSaveOptions = {
  endpoint: string;
  debounceMs?: number;
};

type FieldConfig = {
  tier: SaveTier;
  serialize?: (v: any) => any; // Transform before sending to API
};

/**
 * Smart save hook — handles three tiers:
 * - instant: fires PATCH immediately on change (toggles, dropdowns)
 * - autosave: debounces, fires on blur or after delay (text fields)
 * - explicit: waits for manual saveAll() call (destructive changes)
 *
 * True dirty detection: compares current value against the original from the DB.
 */
export function useSmartSave<T extends Record<string, any>>(
  original: T,
  fields: Record<keyof T, FieldConfig>,
  options: UseSmartSaveOptions,
) {
  const [values, setValues] = useState<T>({ ...original });
  const [statuses, setStatuses] = useState<Record<string, FieldStatus>>(() => {
    const s: Record<string, FieldStatus> = {};
    for (const k of Object.keys(fields)) s[k] = "idle";
    return s;
  });
  const originalRef = useRef<T>({ ...original });
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debounceMs = options.debounceMs ?? 1500;

  // Sync original when it changes (e.g. after initial load)
  useEffect(() => {
    originalRef.current = { ...original };
    setValues({ ...original });
  }, [JSON.stringify(original)]);

  function isDirty(field: keyof T): boolean {
    return JSON.stringify(values[field]) !== JSON.stringify(originalRef.current[field]);
  }

  function isAnyDirtyExplicit(): boolean {
    return Object.keys(fields).some(
      (k) => fields[k as keyof T].tier === "explicit" && JSON.stringify(values[k as keyof T]) !== JSON.stringify(originalRef.current[k as keyof T])
    );
  }

  async function patchFields(fieldNames: (keyof T)[]) {
    // Filter to only dirty fields
    const dirty = fieldNames.filter((f) => isDirtyField(f));
    if (dirty.length === 0) return;

    // Set saving status
    for (const f of dirty) setStatus(f as string, "saving");

    const body: Record<string, any> = {};
    for (const f of dirty) {
      const config = fields[f];
      body[f as string] = config.serialize ? config.serialize(values[f]) : values[f];
    }

    try {
      const res = await fetch(options.endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        // Update original to current (no longer dirty)
        for (const f of dirty) {
          (originalRef.current as any)[f] = values[f];
          setStatus(f as string, "saved");
        }
        // Clear "saved" after 2s
        setTimeout(() => {
          for (const f of dirty) setStatus(f as string, "idle");
        }, 2000);
      } else {
        for (const f of dirty) setStatus(f as string, "error");
        setTimeout(() => {
          for (const f of dirty) setStatus(f as string, "idle");
        }, 3000);
      }
    } catch {
      for (const f of dirty) setStatus(f as string, "error");
      setTimeout(() => {
        for (const f of dirty) setStatus(f as string, "idle");
      }, 3000);
    }
  }

  function isDirtyField(field: keyof T): boolean {
    return JSON.stringify(values[field]) !== JSON.stringify(originalRef.current[field]);
  }

  function setStatus(field: string, status: FieldStatus) {
    setStatuses((prev) => ({ ...prev, [field]: status }));
  }

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));

    const config = fields[field];
    if (!config) return;

    if (config.tier === "instant") {
      // Check if actually different from original
      if (JSON.stringify(value) === JSON.stringify(originalRef.current[field])) return;
      // Fire immediately
      setTimeout(() => {
        const body: Record<string, any> = {};
        body[field as string] = config.serialize ? config.serialize(value) : value;
        setStatus(field as string, "saving");
        fetch(options.endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((res) => {
          if (res.ok) {
            (originalRef.current as any)[field] = value;
            setStatus(field as string, "saved");
            setTimeout(() => setStatus(field as string, "idle"), 2000);
          } else {
            setStatus(field as string, "error");
            setTimeout(() => setStatus(field as string, "idle"), 3000);
          }
        }).catch(() => {
          setStatus(field as string, "error");
          setTimeout(() => setStatus(field as string, "idle"), 3000);
        });
      }, 0);
    }

    if (config.tier === "autosave") {
      // Clear existing timer
      if (debounceTimers.current[field as string]) {
        clearTimeout(debounceTimers.current[field as string]);
      }
      // Set new debounce timer
      debounceTimers.current[field as string] = setTimeout(() => {
        if (JSON.stringify(value) !== JSON.stringify(originalRef.current[field])) {
          patchFields([field]);
        }
      }, debounceMs);
    }
  }, [fields, options.endpoint, debounceMs]);

  /** Flush autosave immediately (call on blur) */
  const flushField = useCallback((field: keyof T) => {
    if (debounceTimers.current[field as string]) {
      clearTimeout(debounceTimers.current[field as string]);
      delete debounceTimers.current[field as string];
    }
    if (fields[field]?.tier === "autosave" && isDirtyField(field)) {
      patchFields([field]);
    }
  }, [fields, options.endpoint]);

  /** Save all dirty explicit fields */
  const saveAll = useCallback(() => {
    const explicitFields = Object.keys(fields).filter(
      (k) => fields[k as keyof T].tier === "explicit"
    ) as (keyof T)[];
    return patchFields(explicitFields);
  }, [fields, options.endpoint, values]);

  return {
    values,
    setValue,
    flushField,
    saveAll,
    statuses,
    isDirty,
    hasUnsavedExplicit: isAnyDirtyExplicit(),
  };
}
