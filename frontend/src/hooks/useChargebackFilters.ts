import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { ChargebackFilters } from "../types/filters";
import {
  todayStr,
  thirtyDaysAgoStr,
  loadDatesFromStorage,
  saveDatesToStorage,
  clearDatesFromStorage,
} from "../utils/dateFilterStorage";

const FILTER_KEYS: (keyof ChargebackFilters)[] = [
  "start_date",
  "end_date",
  "identity_id",
  "product_type",
  "resource_id",
  "cost_type",
];

const DATE_STORAGE_KEY = "chargeback_date_range";
const DATE_FIELDS: (keyof ChargebackFilters)[] = ["start_date", "end_date"];

interface UseChargebackFiltersReturn {
  filters: ChargebackFilters;
  setFilter: (key: keyof ChargebackFilters, value: string | null) => void;
  setFilters: (updates: Partial<ChargebackFilters>) => void;
  resetFilters: () => void;
  toQueryParams: () => Record<string, string>;
  queryParams: Record<string, string>;   // stable memoized value for render-time use
}

export function useChargebackFilters(): UseChargebackFiltersReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Cache localStorage read — only re-read when searchParams change (which triggers a
  // re-render anyway). Avoids redundant JSON.parse on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams triggers re-read of localStorage when URL changes
  const storedDates = useMemo(() => loadDatesFromStorage(DATE_STORAGE_KEY), [searchParams]);
  const spStartDate = searchParams.get("start_date");
  const spEndDate = searchParams.get("end_date");
  const spIdentityId = searchParams.get("identity_id");
  const spProductType = searchParams.get("product_type");
  const spResourceId = searchParams.get("resource_id");
  const spCostType = searchParams.get("cost_type");

  const filters: ChargebackFilters = useMemo(
    () => ({
      start_date: spStartDate ?? storedDates.start_date ?? thirtyDaysAgoStr(),
      end_date: spEndDate ?? storedDates.end_date ?? todayStr(),
      identity_id: spIdentityId,
      product_type: spProductType,
      resource_id: spResourceId,
      cost_type: spCostType,
    }),
    [spStartDate, spEndDate, spIdentityId, spProductType, spResourceId, spCostType, storedDates.start_date, storedDates.end_date],
  );

  const setFilter = useCallback(
    (key: keyof ChargebackFilters, value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null || value === "") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
      // Persist date fields to localStorage
      if (DATE_FIELDS.includes(key)) {
        const current = loadDatesFromStorage(DATE_STORAGE_KEY);
        const stored = value === null || value === "" ? null : value;
        const updated = { ...current, [key]: stored };
        saveDatesToStorage(DATE_STORAGE_KEY, updated.start_date, updated.end_date);
      }
    },
    [setSearchParams],
  );

  const setFilters = useCallback(
    (updates: Partial<ChargebackFilters>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === undefined || value === "") {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace: true },
      );
      // Persist date fields to localStorage
      const hasDateUpdate = DATE_FIELDS.some((f) => f in updates);
      if (hasDateUpdate) {
        const current = loadDatesFromStorage(DATE_STORAGE_KEY);
        const updated = {
          start_date:
            "start_date" in updates ? (updates.start_date ?? null) : current.start_date,
          end_date:
            "end_date" in updates ? (updates.end_date ?? null) : current.end_date,
        };
        saveDatesToStorage(DATE_STORAGE_KEY, updated.start_date, updated.end_date);
      }
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of FILTER_KEYS) {
          next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
    clearDatesFromStorage(DATE_STORAGE_KEY);
  }, [setSearchParams]);

  // Stable memoized object — only recomputed when filter values change
  const queryParams: Record<string, string> = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of FILTER_KEYS) {
      const val = filters[key];
      if (val !== null) {
        result[key] = val;
      }
    }
    return result;
  }, [filters]);

  // Keep toQueryParams for event handler usage (handleSelectAll) — returns stable queryParams
  const toQueryParams = useCallback(
    (): Record<string, string> => queryParams,
    [queryParams],
  );

  return { filters, setFilter, setFilters, resetFilters, toQueryParams, queryParams };
}
