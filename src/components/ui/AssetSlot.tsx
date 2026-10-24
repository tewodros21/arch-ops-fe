import { useState } from 'react'
import clsx from 'clsx'
import { ImagePlus } from 'lucide-react'

interface AssetSlotProps {
  /** Path under /public, e.g. /assets/3d/hero.png */
  src: string
  label: string
  className?: string
  imgClassName?: string
  placeholderClassName?: string
  dark?: boolean
}

// Renders the image once it exists in /public; until then shows a marked
// placeholder so the layout keeps its space for the real 3D / cut-out asset.
export function AssetSlot({ src, label, className, imgClassName, placeholderClassName, dark }: AssetSlotProps) {
  const [missing, setMissing] = useState(false)

  if (!missing) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        onError={() => setMissing(true)}
        className={clsx('pointer-events-none select-none object-contain', className, imgClassName)}
      />
    )
  }

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed p-4 text-center',
        dark ? 'border-white/20 text-white/50' : 'border-black/15 text-black/40',
        className,
        placeholderClassName,
      )}
    >
      <ImagePlus size={28} strokeWidth={1.5} />
      <span className="text-sm font-medium">{label}</span>
      <code className="text-[11px] opacity-80">public{src}</code>
    </div>
  )
}
