// Event times. Plans store startsAt (ms); labels like "Today 18:30" are worked out when shown,
// so they stay right on the day of the demo. Older plans only have a fixed `when` label.
const H = 3600000;
export const EVENT_LENGTH = 2 * H;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hhmm = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function fmtWhen(ms, now = Date.now()) {
  const d = new Date(ms), days = Math.round((dayStart(d) - dayStart(new Date(now))) / (24 * H));
  if (days === 0) return (d.getHours() >= 19 ? 'Tonight ' : 'Today ') + hhmm(d);
  if (days === 1) return 'Tomorrow ' + hhmm(d);
  if (days > 1 && days < 7) return DAYS[d.getDay()] + ' ' + hhmm(d);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${hhmm(d)}`;
}
export const whenLabel = p => p.startsAt ? fmtWhen(p.startsAt) : p.when;
export const endsAt = p => p.endsAt || (p.startsAt ? p.startsAt + EVENT_LENGTH : 0);
// An event is over once its end time has passed (or the presenter ended it from the console).
export const isOver = (p, now = Date.now()) => p.status === 'ended' || (endsAt(p) > 0 && endsAt(p) < now);

// A time on a given day: dayOffset 0 = today; weekday 6 = the next Saturday.
export function at(h, m, { dayOffset = 0, weekday = null } = {}, now = Date.now()) {
  const d = new Date(now);
  if (weekday != null) d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7 || 7));
  else d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
// The value format a datetime-local input expects, in local time: "2026-10-06T18:30".
export function toLocalInput(ms) {
  const d = new Date(ms), z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
