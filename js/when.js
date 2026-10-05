// Event times. Plans store startsAt (ms); labels like "Today 18:30" are worked out when shown,
// so they stay right on the day of the demo. Older plans only have a fixed `when` label.
const H = 3600000;
export const EVENT_LENGTH = 2 * H;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hhmm = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function fmtWhen(ms, now = Date.now()) {
  const d = new Date(ms), days = Math.round((dayStart(d) - dayStart(new Date(now))) / (24 * H));
  if (days === 0) return (d.getHours() >= 19 ? 'Tonight ' : 'Today ') + hhmm(d);
  if (days === 1) return 'Tomorrow ' + hhmm(d);
  if (days > 1 && days < 7) return DAYS[d.getDay()] + ' ' + hhmm(d);
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + hhmm(d);
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
// Choices for the post form. "In 30 minutes" lets the class see a whole plan, start to end, during the demo.
export function whenChoices(now = Date.now()) {
  const soon = Math.ceil((now + 30 * 60000) / (5 * 60000)) * 5 * 60000;
  const list = [soon, at(17, 30, {}, now), at(20, 0, {}, now), at(12, 30, { dayOffset: 1 }, now), at(19, 0, { dayOffset: 1 }, now), at(15, 0, { weekday: 6 }, now), at(11, 0, { weekday: 0 }, now)]
    .filter(t => t > now + 10 * 60000);
  return [...new Set(list)].sort((a, b) => a - b).map(t => ({ at: t, label: t === soon ? `In 30 minutes (${hhmm(new Date(t))})` : fmtWhen(t, now) }));
}
