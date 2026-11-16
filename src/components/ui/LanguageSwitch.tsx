import clsx from 'clsx'
import { setStoreKeeperLang, useLang, type Lang } from '@/lib/i18n'

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'am', label: 'አማርኛ' },
  { value: 'en', label: 'English' },
]

/** Store Keepers default to Amharic; this lets them switch to English and back */
export function LanguageSwitch() {
  const lang = useLang()
  return (
    <div role="group" aria-label="Language / ቋንቋ" className="inline-flex rounded-full bg-white/10 p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-pressed={lang === option.value}
          onClick={() => setStoreKeeperLang(option.value)}
          className={clsx(
            'focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            lang === option.value ? 'bg-[var(--sun)] text-[var(--ink)]' : 'text-white/70 hover:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
