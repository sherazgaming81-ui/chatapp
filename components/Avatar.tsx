import { avatarColor, initials } from '@/lib/format';

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
        src={photoURL}
        alt={name}
        width={size}
        height={size}
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
