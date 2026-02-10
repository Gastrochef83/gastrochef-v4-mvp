import { useEffect } from 'react'

export function Toast({
  open,
  message,
  onClose,
}: {
  open: boolean
  message: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const t = setTimeout(onClose, 2600)
    return () => clearTimeout(t)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="gc-card px-5 py-3 shadow-2xl border border-black/10">
        <div className="text-sm font-semibold">{message}</div>
      </div>
    </div>
  )
}
