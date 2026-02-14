import { useEffect, useMemo, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Recipe = {
  id: string
  name: string
  photo_url?: string | null
  method_steps?: string[] | null
  method_step_photos?: string[] | null
}

function normalizeSteps(steps: string[] | null | undefined) {
  return (steps ?? []).map((s) => (s ?? '').trim()).filter(Boolean)
}

export default function RecipeCookMode() {
  const [sp] = useSearchParams()
  const id = sp.get('id')

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!id) {
      setErr('Missing recipe id (?id=...)')
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      setErr(null)

      const { data, error } = await supabase
        .from('recipes')
        .select('id,name,photo_url,method_steps,method_step_photos')
        .eq('id', id)
        .single()

      if (error) {
        setErr(error.message)
        setRecipe(null)
        setLoading(false)
        return
      }

      setRecipe(data as any)
      setIdx(0)
      setLoading(false)
    }

    load()
  }, [id])

  const steps = useMemo(() => normalizeSteps(recipe?.method_steps), [recipe?.method_steps])
  const photos = recipe?.method_step_photos ?? []
  const total = steps.length

  const canPrev = idx > 0
  const canNext = idx < total - 1

  if (loading) return <div className="gc-card p-6">Loading cook mode…</div>

  if (err) {
    return (
      <div className="gc-card p-6 space-y-3">
        <div className="gc-label">ERROR</div>
        <div className="text-sm text-red-600">{err}</div>
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
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-400">KITCHEN MODE</div>
            <div className="text-2xl font-extrabold">{recipe.name}</div>
            <div className="mt-1 text-xs text-neutral-400">
              Step <span className="font-semibold">{total === 0 ? 0 : idx + 1}</span> / {total}
            </div>
          </div>

          <NavLink className="gc-btn gc-btn-ghost" to={`/recipe?id=${recipe.id}`}>
            Exit
          </NavLink>
        </div>

        {total === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <div className="text-sm text-neutral-200">No steps yet. Add steps in Recipe Editor.</div>
          </div>
        ) : (
          <>
            {photos[idx] ? (
              <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-black">
                <img src={photos[idx]} alt={`Step ${idx + 1}`} className="w-full max-h-[460px] object-cover" />
              </div>
            ) : null}

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <div className="text-xs font-semibold text-neutral-400">STEP {idx + 1}</div>
              <div className="mt-3 text-xl leading-relaxed">{steps[idx]}</div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                className="gc-btn gc-btn-ghost"
                onClick={() => setIdx((p) => Math.max(0, p - 1))}
                disabled={!canPrev}
              >
                ← Back
              </button>

              <button
                className="gc-btn gc-btn-primary"
                onClick={() => setIdx((p) => Math.min(total - 1, p + 1))}
                disabled={!canNext}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
