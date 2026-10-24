// Initials avatar in the app-shell warm palette
const AVATAR_TONES = ['#e4532d', '#f6b73c', '#ef8a5f', '#8a7f78', '#c23d1a']

export function Avatar({ initials, index = 0, size = 36 }: { initials: string; index?: number; size?: number }) {
  const bg = AVATAR_TONES[index % AVATAR_TONES.length]
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{ width: size, height: size, background: bg, color: bg === '#f6b73c' ? '#181412' : '#fff' }}
    >
      {initials}
    </span>
  )
}
