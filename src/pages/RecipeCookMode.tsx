import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Toast } from '../components/Toast'

type Recipe = {
  id: string
  kitchen_id: string
  name: string
  category: string | null
  portions: number
  yield_qty: number | null
  yield_unit: string | null
  is_subrecipe: boolean
  is_archived: boolean
  photo_url?: string | null
  description?: string | null
  method_steps?: string[] | null
}

function normalizeSteps(steps: string[] | null | undefined) {
  return (steps ?? []).map((s) => (s ?? '').trim()).filter(Boolean)
}

export default function RecipeCookMode() {
  const location = useLocation()
  const [sp] = useSearchParams()
  const id = sp.get('id')

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [steps, setSteps] = useState<string[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  // ---- STEP PHOTOS (storage: recipe-photos) ----
  // We’ll fetch all images in: steps/{recipeId}/
  const [stepPhotos, setStepPhotos] = useState<Record<number, string[]>>({})
  const [photosLoading, setPhotosLoading] = useState(false)

  // Toast
  const [toastMsg, setToastMsg] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastOpen(true)
  }

  const loadRecipe = async (recipeId: string) => {
    const { data: r, error } = await supabase
      .from('recipes')
      .select('id,kitchen_id,name,category,portions,yield_qty,yield_unit,is_subrecipe,is_archived,photo_url,description,method_steps')
      .eq('id', recipeId)
      .single()
    if (error) throw error

    const rr = r as Recipe
    setRecipe(rr)

    const s = normalizeSteps(rr.method_steps)
    setSteps(s)
    setActiveIdx(0)
  }

  const listStepPhotos = async (recipeId: string) => {
    // Convention:
    // recipe-photos bucket:
    // steps/{recipeId}/step-01/
    // steps/{recipeId}/step-02/
    // each folder contains images
    setPhotosLoading(true)
    try {
      const base = `steps/${recipeId}`
      const { data: stepFolders, error: listErr } = await supabase.storage.from('recipe-photos').list(base, {
        limit: 200,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (listErr) throw listErr

      // stepFolders may include folders like "step-01", "step-02"
      const map: Record<number, string[]> = {}

      for (const f of stepFolders ?? []) {
        const folderName = f.name || ''
        if (!folderName.startsWith('step-')) continue
        const num = Number(folderName.replace('step-', ''))
        if (!Number.isFinite(num) || num <= 0) continue

        const { data: files, error: filesErr } = await supabase.storage.from('recipe-photos').list(`${base}/${folderName}`, {
          limit: 200,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        })
        if (filesErr) throw filesErr

        const urls: string[] = []
        for (const file of files ?? []) {
          // ignore folders
          if (!file.name || file.name.includes('/')) continue
          const { data: pub } = supabase.storage.from('recipe-photos').getPublicUrl(`${base}/${folderName}/${file.name}`)
          if (pub?.publicUrl) urls.push(pub.publicUrl)
        }

        // step index is num-1
        map[num - 1] = urls
      }

      setStepPhotos(map)
    } catch (e: any) {
      // non-fatal
      setStepPhotos({})
    } finally {
      setPhotosLoading(false)
    }
  }

  useEffect(() => {
    if (!id) {
      setErr('Missing recipe id in URL (?id=...)')
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)

    Promise.all([loadRecipe(id), listStepPhotos(id)])
      .then(() => setLoading(false))
      .catch((e: any) => {
        setErr(e?.message ?? 'Unknown error')
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const totalSteps = steps.length
  const stepText = steps[activeIdx] ?? ''
  const photosForStep = stepPhotos[activeIdx] ?? []

  const canPrev = activeIdx > 0
  const canNext = activeIdx < totalSteps - 1

  const goPrev = () => setActiveIdx((x) => Math.max(0, x - 1))
  const goNext = () => setActiveIdx((x) => Math.min(totalSteps - 1, x + 1))

  const progress = useMemo(() => {
    if (totalSteps <= 0) return 0
    return Math.round(((activeIdx + 1) / totalSteps) * 100)
  }, [activeIdx, totalSteps])

  if (loading) return <div className="gc-card p-6">Loading Cook Mode…</div>
  if (err) {
    return (
      <div className="gc-card p-6 space-y-3">
        <div className="gc-label">ERROR</div>
        <div className="text-sm text-red-600">{err}</div>
        <div className="text-xs text-neutral-500">
          Debug: <span className="font-mono">{location.pathname + location.search}</span>
        </div>
        <NavLink className="gc-btn gc-btn-primary" to="/recipes">
          Back to Recipes
        </NavLink>
      </div>
    )
  }
  if (!recipe) {
    return (
      <div className="gc-card p-6 space-y-3">
        <div className="gc-label">NOT FOUND</div>
        <div className="text-sm text-neutral-600">Recipe not found.</div>
        <NavLink className="gc-btn gc-btn-primary" to="/recipes">
          Back to Recipes
        </NavLink>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="gc-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[min(680px,92vw)]">
            <div className="gc-label">KITCHEN MODE</div>
            <div className="mt-1 text-2xl font-extrabold">{recipe.name}</div>
            <div className="mt-1 text-sm text-neutral-600">
              Step {totalSteps ? activeIdx + 1 : 0} / {totalSteps || '—'} · Progress {progress}%
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full bg-neutral-900" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="gc-btn gc-btn-ghost" type="button" onClick={goPrev} disabled={!canPrev}>
                ← Prev
              </button>
              <button className="gc-btn gc-btn-primary" type="button" onClick={goNext} disabled={!canNext}>
                Next →
              </button>

              <NavLink className="gc-btn gc-btn-ghost" to={`/recipe?id=${recipe.id}`}>
                Open Editor
              </NavLink>

              <NavLink className="gc-btn gc-btn-ghost" to="/recipes">
                Back
              </NavLink>
            </div>
          </div>

          <div className="w-[260px]">
            <div className="gc-label">DISH PHOTO</div>
            <div className="mt-2 h-44 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
              {recipe.photo_url ? (
                <img src={recipe.photo_url} alt={recipe.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">No Photo</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step Card */}
      <div className="gc-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="gc-label">CURRENT STEP</div>
            <div className="mt-1 text-lg font-extrabold">Step {totalSteps ? activeIdx + 1 : '—'}</div>
          </div>

          <div className="flex gap-2">
            <button className="gc-btn gc-btn-ghost" type="button" onClick={() => showToast('Tip: Use Next/Prev for fast kitchen flow ✅')}>
              Tip
            </button>
          </div>
        </div>

        {totalSteps === 0 ? (
          <div className="mt-4 text-sm text-neutral-600">No steps yet. Add steps in Recipe Editor.</div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_.9fr]">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="text-sm font-semibold text-neutral-600">Instruction</div>
              <div className="mt-3 whitespace-pre-wrap text-xl font-extrabold leading-snug text-neutral-900">{stepText}</div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-neutral-600">Step Photos</div>
                <div className="text-xs text-neutral-500">{photosLoading ? 'Loading…' : `${photosForStep.length} photo(s)`}</div>
              </div>

              {photosForStep.length === 0 ? (
                <div className="mt-3 text-sm text-neutral-600">
                  No step photos.
                  <div className="mt-1 text-xs text-neutral-500">
                    Storage path: <span className="font-mono">recipe-photos/steps/{recipe.id}/step-0{activeIdx + 1}/</span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {photosForStep.map((u, idx) => (
                    <div key={idx} className="h-28 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                      <img src={u} alt={`step-${activeIdx + 1}-${idx + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step List Quick Jump */}
      <div className="gc-card p-6">
        <div className="gc-label">JUMP TO STEP</div>
        {totalSteps === 0 ? (
          <div className="mt-3 text-sm text-neutral-600">—</div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`gc-btn ${i === activeIdx ? 'gc-btn-primary' : 'gc-btn-ghost'}`}
                onClick={() => setActiveIdx(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <Toast open={toastOpen} message={toastMsg} onClose={() => setToastOpen(false)} />
    </div>
  )
}
