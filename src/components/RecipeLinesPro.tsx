import * as React from 'react'

export default function ServingsSlider({
  value,
  onChange,
  min = 1,
  max = 50,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="gc-label">SERVINGS PREVIEW</div>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-56"
      />

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value || min)
          onChange(Math.max(min, Math.min(max, n)))
        }}
        className="gc-input w-28"
      />
    </div>
  )
}
