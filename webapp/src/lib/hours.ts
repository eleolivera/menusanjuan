// Restaurant hours helper
// Format: {"lun":{"open":"08:00","close":"23:00","closed":false},...}

type DayHours = { open: string; close: string; closed: boolean };
type WeekHours = Record<string, DayHours>;

const DAY_KEYS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

export function isRestaurantOpen(openHours: string | null): boolean {
  if (!openHours) return true; // Assume open if no hours set

  try {
    const week = JSON.parse(openHours) as WeekHours;
    const now = new Date();
    // Argentina is UTC-3
    const argNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const dayKey = DAY_KEYS[argNow.getDay()];
    const todayHours = week[dayKey];
    if (!todayHours || todayHours.closed) return false;

    const [openH, openM] = todayHours.open.split(":").map(Number);
    const [closeH, closeM] = todayHours.close.split(":").map(Number);
    const currentMinutes = argNow.getHours() * 60 + argNow.getMinutes();
    const openMinutes = openH * 60 + openM;
    let closeMinutes = closeH * 60 + closeM;

    // Handle past-midnight close (e.g. close at 00:00 means next day)
    if (closeMinutes <= openMinutes) closeMinutes += 24 * 60;

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch {
    return true;
  }
}

export function getNextOpenTime(openHours: string | null): string | null {
  if (!openHours) return null;
  try {
    const week = JSON.parse(openHours) as WeekHours;
    const argNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    // Check next 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(argNow);
      date.setDate(date.getDate() + i);
      const dayKey = DAY_KEYS[date.getDay()];
      const dh = week[dayKey];
      if (dh && !dh.closed) {
        if (i === 0) {
          const [h, m] = dh.open.split(":").map(Number);
          const openMin = h * 60 + m;
          const nowMin = argNow.getHours() * 60 + argNow.getMinutes();
          if (nowMin < openMin) return `Hoy ${dh.open}`;
        } else {
          const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
          return `${dayNames[date.getDay()]} ${dh.open}`;
        }
      }
    }
  } catch {}
  return null;
}
