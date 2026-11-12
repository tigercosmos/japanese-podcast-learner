interface Props {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export default function Toggle({ label, checked, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        checked
          ? 'border-ink bg-ink text-paper'
          : 'border-line bg-card text-muted hover:border-muted'
      }`}
      onClick={() => onChange(!checked)}
    >
      {label}
    </button>
  )
}
