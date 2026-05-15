// Restaurant hours helpers
//
// Modern schema (pickupHours / deliveryHours): per-day arrays of 1-2 open/close windows.
//   {"lun":[{"open":"12:00","close":"14:00"},{"open":"20:00","close":"00:30"}], "mar":[...], "dom":[]}
//   Empty array = closed that day.
//
// Legacy schema (openHours, kept for back-compat): single window with explicit closed flag.
//   {"lun":{"open":"08:00","close":"23:00","closed":false}, ...}

export type ServiceWindow = { open: string; close: string };
export type ServiceWeekHours = Record<string, ServiceWindow[]>;

type LegacyDayHours = { open: string; close: string; closed: boolean };
type LegacyWeekHours = Record<string, LegacyDayHours>;

const DAY_KEYS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
const DAY_LABELS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_LABELS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export const DAY_KEY_ORDER = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;
export const DAY_KEY_TO_LABEL: Record<string, string> = {
  lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves", vie: "Viernes", sab: "Sábado", dom: "Domingo",
};

function parseHours(raw: string | null | undefined): ServiceWeekHours | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Detect legacy format (has .open + .closed at the value level) and convert
    const firstVal = parsed[Object.keys(parsed)[0]];
    if (firstVal && typeof firstVal === "object" && !Array.isArray(firstVal) && "open" in firstVal && "closed" in firstVal) {
      const legacy = parsed as LegacyWeekHours;
      const out: ServiceWeekHours = {};
      for (const k of Object.keys(legacy)) {
        const d = legacy[k];
        out[k] = d.closed ? [] : [{ open: d.open, close: d.close }];
      }
      return out;
    }
    return parsed as ServiceWeekHours;
  } catch {
    return null;
  }
}

function argNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
}

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Is the given schedule currently open? */
export function isServiceOpenNow(raw: string | null | undefined): boolean {
  const week = parseHours(raw);
  if (!week) return true; // no hours set → assume open
  const now = argNow();
  const dayKey = DAY_KEYS[now.getDay()];
  const todayWindows = week[dayKey] || [];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const w of todayWindows) {
    const openMin = hhmmToMinutes(w.open);
    let closeMin = hhmmToMinutes(w.close);
    if (closeMin <= openMin) closeMin += 24 * 60; // past-midnight close
    if (currentMinutes >= openMin && currentMinutes < closeMin) return true;
  }

  // Also check yesterday's last window if it spilled past midnight
  const prevDayKey = DAY_KEYS[(now.getDay() + 6) % 7];
  const prevWindows = week[prevDayKey] || [];
  const minutesIntoToday = currentMinutes; // 0-1439
  for (const w of prevWindows) {
    const openMin = hhmmToMinutes(w.open);
    const closeMin = hhmmToMinutes(w.close);
    if (closeMin <= openMin) {
      // window spans midnight; check if "now" is in the wee hours portion
      const closeMinNextDay = closeMin + 24 * 60;
      const spilloverEnd = closeMinNextDay - 24 * 60; // = closeMin
      if (minutesIntoToday < spilloverEnd) return true;
    }
  }

  return false;
}

/** Next time the schedule opens, as a friendly label like "Hoy 20:00" or "Lun 12:00". */
export function getNextServiceOpenTime(raw: string | null | undefined): string | null {
  const week = parseHours(raw);
  if (!week) return null;
  const now = argNow();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const dayKey = DAY_KEYS[date.getDay()];
    const windows = (week[dayKey] || []).slice().sort((a, b) => hhmmToMinutes(a.open) - hhmmToMinutes(b.open));
    if (windows.length === 0) continue;
    for (const w of windows) {
      const openMin = hhmmToMinutes(w.open);
      if (i === 0) {
        if (nowMin < openMin) return `Hoy ${w.open}`;
      } else {
        return `${DAY_LABELS_SHORT[date.getDay()]} ${w.open}`;
      }
    }
  }
  return null;
}

/** Default empty week — all days closed. */
export function emptyWeek(): ServiceWeekHours {
  return { lun: [], mar: [], mie: [], jue: [], vie: [], sab: [], dom: [] };
}

/** Backward-compat: legacy single-window helper. New code should use isServiceOpenNow. */
export function isRestaurantOpen(openHours: string | null): boolean {
  return isServiceOpenNow(openHours);
}

/** Backward-compat: legacy next-open helper. */
export function getNextOpenTime(openHours: string | null): string | null {
  return getNextServiceOpenTime(openHours);
}

export { DAY_LABELS_FULL, DAY_LABELS_SHORT };
