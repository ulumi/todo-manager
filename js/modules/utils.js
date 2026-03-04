// ════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════

export const DS = d => `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
export const p2 = n => String(n).padStart(2,'0');

export function parseDS(s) {
  const [y,m,d]=s.split('-').map(Number);
  return new Date(y,m-1,d);
}

export function today() {
  const d=new Date();
  d.setHours(0,0,0,0);
  return d;
}

export function addDays(d,n) {
  const r=new Date(d);
  r.setDate(r.getDate()+n);
  return r;
}

export function startOfWeek(d) {
  const r=new Date(d);
  r.setDate(r.getDate()-r.getDay());
  return r;
}

export function daysInMonth(y,m) {
  return new Date(y,m+1,0).getDate();
}

export function firstDayOfMonth(y,m) {
  return new Date(y,m,1).getDay();
}

export function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
