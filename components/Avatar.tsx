import { avatarColor, initials } from '@/lib/format';

/**
 * HD avatar: Google profile photos ke thumbnail param (=s96-c) ko bada karke
 * high-res version mangwata hai, taake bari avatar (120px+) me photo saaf lage.
 */
function hdURL(url?: string): string | undefined {
  if (!url) return url;
  const m = url.match(/=s(\d+)(-c)?$/);
  if (m && Number(m[1]) < 256) return url.replace(/=s\d+(-c)?$/, '=s256-c');
  return url;
}

export default function Avatar({
  name,
  photoURL,
  size = 40,
}: {
  name: string;
  photoURL?: string;
  size?: number;
}) {
  if (photoURL) {
    return (
      <img
        src={hdURL(photoURL)}
        alt={name}
        width={size}
        height={size}
        draggable={false}
        loading="lazy"
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}
