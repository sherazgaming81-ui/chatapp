export function fmtTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function fmtListTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (dayDiff === 0) return fmtTime(ts);
  if (dayDiff === 1) return 'Yesterday';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function fmtDateDivider(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (dayDiff === 0) return 'TODAY';
  if (dayDiff === 1) return 'YESTERDAY';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

export function fmtLastSeen(ts: number, online: boolean): string {
  if (online) return 'online';
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'last seen just now';
  if (diff < 3600000) return `last seen ${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `last seen ${Math.floor(diff / 3600000)} hours ago`;
  return `last seen ${new Date(ts).toLocaleDateString()}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

const COLORS = ['#00a884', '#7f66ff', '#ff5c8a', '#ff9f1c', '#2ec4b6', '#e71d36', '#4cc9f0'];
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}
