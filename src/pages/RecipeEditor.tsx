import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase' // ✅ غيّرها إذا اسم الملف مختلف

type RecipeRow = {
  id: string
  kitchen_id: string
  name: string | null
  category: string | null
  portions: number | null
  description: string | null
  method: string | null
  photo_urls: string[] | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  currency: string | null
  target_food_cost_pct: number | null
  selling_price: number | null
}

type TabKey = 'ingredients' | 'steps' | 'pricing' | 'nutrition' | 'photos'

type StepRow = {
  id: string
  kitchen_id: string
  recipe_id: string
  order_index: number
  title: string | null
  body: string
  timer_seconds: number | null
}

function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

function numOrNull(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function getKitchenIdSafe(): Promise<string | null> {
  const fromLS =
    localStorage.getItem('gc_kitchen_id') ||
    localStorage.getItem('kitchen_id') ||
    localStorage.getItem('current_kitchen_id')
  if (fromLS) return fromLS

  const { data: auth } = await supabase.auth.getUser()
  const metaKid = (auth?.user?.user_metadata as any)?.kitchen_id
  if (typeof metaKid === 'string' && metaKid.length > 0) return metaKid

  const { data: kid, error } = await supabase.rpc('current_kitchen_id')
  if (!error && typeof kid === 'string' && kid.length > 0) return kid

  return null
}

export default function RecipeEditor() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recipeId = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [tab, setTab] = useState<TabKey>('ingredients')

  const [recipe, setRecipe] = useState<RecipeRow | null>(null)

  // Steps state
  const [stepsLoading, setStepsLoading] = useState(false)
  const [stepsError, setStepsError] = useState('')
  const [steps, setSteps] = useState<StepRow[]>([])
  const [stepsSavingId, setStepsSavingId] = useState<string | null>(null)

  const title = useMemo(() => recipe?.name || 'Untitled Recipe', [recipe?.name])

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      setErrorMsg('')

      try {
        if (!recipeId) {
          setErrorMsg('Missing recipe id in URL. Go back to Recipes and click Open.')
          setLoading(false)
          return
        }

        const kitchenId = await getKitchenIdSafe()
        if (!kitchenId) {
          setErrorMsg('No kitchen_id found. Open Ingredients or Recipes once, then try again.')
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('recipes')
          .select(
            'id,kitchen_id,name,category,portions,description,method,photo_urls,calories,protein_g,carbs_g,fat_g,currency,target_food_cost_pct,selling_price'
          )
          .eq('kitchen_id', kitchenId)
          .eq('id', recipeId)
          .maybeSingle()

        if (!alive) return
        if (error) throw error
        if (!data) {
          setErrorMsg('Recipe not found (or RLS blocked).')
          setLoading(false)
          return
        }

        setRecipe(data as RecipeRow)
        setLoading(false)
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load recipe.')
        setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [recipeId])

  // Load steps when steps tab opened (or when recipe loaded)
  useEffect(() => {
    if (!recipe) return
    if (tab !== 'steps') return
    void loadSteps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, recipe?.id])

  async function saveRecipe(patch: Partial<RecipeRow>) {
    if (!recipe) return
    setSaving(true)
    setErrorMsg('')

    try {
      const next = { ...recipe, ...patch }
      setRecipe(next)

      const { error } = await supabase
        .from('recipes')
        .update({
          name: next.name,
          category: next.category,
          portions: next.portions,
          description: next.description,
          method: next.method,
          photo_urls: next.photo_urls,
          calories: next.calories,
          protein_g: next.protein_g,
          carbs_g: next.carbs_g,
          fat_g: next.fat_g,
          currency: next.currency,
          target_food_cost_pct: next.target_food_cost_pct,
          selling_price: next.selling_price,
        })
        .eq('id', next.id)
        .eq('kitchen_id', next.kitchen_id)

      if (error) throw error
      setSaving(false)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Save failed.')
      setSaving(false)
    }
  }

  async function loadSteps() {
    if (!recipe) return
    setStepsLoading(true)
    setStepsError('')

    try {
      const { data, error } = await supabase
        .from('recipe_steps')
        .select('id,kitchen_id,recipe_id,order_index,title,body,timer_seconds')
        .eq('kitchen_id', recipe.kitchen_id)
        .eq('recipe_id', recipe.id)
        .order('order_index', { ascending: true })

      if (error) throw error
      setSteps((data || []) as StepRow[])
      setStepsLoading(false)
    } catch (e: any) {
      setStepsError(e?.message || 'Failed to load steps.')
      setStepsLoading(false)
    }
  }

  async function addStep() {
    if (!recipe) return
    setStepsError('')
    try {
      const nextOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.order_index)) + 1 : 1

      const { data, error } = await supabase
        .from('recipe_steps')
        .insert({
          kitchen_id: recipe.kitchen_id,
          recipe_id: recipe.id,
          order_index: nextOrder,
          title: null,
          body: '',
          timer_seconds: null,
        })
        .select('id,kitchen_id,recipe_id,order_index,title,body,timer_seconds')
        .single()

      if (error) throw error
      setSteps((prev) => [...prev, data as StepRow].sort((a, b) => a.order_index - b.order_index))
    } catch (e: any) {
      setStepsError(e?.message || 'Failed to add step.')
    }
  }

  async function deleteStep(stepId: string) {
    if (!recipe) return
    setStepsError('')
    try {
      const { error } = await supabase
        .from('recipe_steps')
        .delete()
        .eq('kitchen_id', recipe.kitchen_id)
        .eq('recipe_id', recipe.id)
        .eq('id', stepId)

      if (error) throw error

      const remaining = steps.filter((s) => s.id !== stepId)
      // reindex to keep 1..n
      await persistReorder(remaining.map((s, i) => ({ ...s, order_index: i + 1 })))
    } catch (e: any) {
      setStepsError(e?.message || 'Failed to delete step.')
    }
  }

  async function updateStep(stepId: string, patch: Partial<Pick<StepRow, 'title' | 'body' | 'timer_seconds'>>) {
    if (!recipe) return
    setStepsSavingId(stepId)
    setStepsError('')

    try {
      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)))

      const { error } = await supabase
        .from('recipe_steps')
        .update({
          title: patch.title ?? undefined,
          body: patch.body ?? undefined,
          timer_seconds: patch.timer_seconds ?? undefined,
        })
        .eq('kitchen_id', recipe.kitchen_id)
        .eq('recipe_id', recipe.id)
        .eq('id', stepId)

      if (error) throw error
      setStepsSavingId(null)
    } catch (e: any) {
      setStepsSavingId(null)
      setStepsError(e?.message || 'Failed to save step.')
    }
  }

  async function moveStep(stepId: string, dir: 'up' | 'down') {
    const idx = steps.findIndex((s) => s.id === stepId)
    if (idx < 0) return

    const swapWith = dir === 'up' ? idx - 1 : idx + 1
    if (swapWith < 0 || swapWith >= steps.length) return

    const reordered = [...steps]
    const a = reordered[idx]
    const b = reordered[swapWith]
    reordered[idx] = b
    reordered[swapWith] = a

    // reindex to 1..n
    const normalized = reordered.map((s, i) => ({ ...s, order_index: i + 1 }))
    await persistReorder(normalized)
  }

  async function persistReorder(normalized: StepRow[]) {
    if (!recipe) return
    setStepsError('')

    // Optimistic UI
    setSteps(normalized)

    try {
      // batch updates sequentially (simple + stable)
      for (const s of normalized) {
        const { error } = await supabase
          .from('recipe_steps')
          .update({ order_index: s.order_index })
          .eq('kitchen_id', recipe.kitchen_id)
          .eq('recipe_id', recipe.id)
          .eq('id', s.id)

        if (error) throw error
      }
    } catch (e: any) {
      setStepsError(e?.message || 'Failed to reorder steps.')
      // reload to be safe
      await loadSteps()
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Top Bar */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-widest text-neutral-500">
              RECIPE EDITOR — SUPER UPGRADE
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="text-2xl font-extrabold text-neutral-900">{title}</div>
              {saving && (
                <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                  Saving…
                </span>
              )}
            </div>
            <div className="mt-2 text-sm text-neutral-600">
              Tabs + Step Builder Blocks (Paprika++), stable and scalable.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/recipes')}
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
            >
              Back
            </button>
          </div>
        </div>

        {/* Quick Fields */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs font-semibold tracking-widest text-neutral-500">NAME</div>
            <input
              value={recipe?.name || ''}
              onChange={(e) => saveRecipe({ name: e.target.value })}
              placeholder="Recipe name…"
              className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
              disabled={loading}
            />
          </div>

          <div>
            <div className="text-xs font-semibold tracking-widest text-neutral-500">CATEGORY</div>
            <input
              value={recipe?.category || ''}
              onChange={(e) => saveRecipe({ category: e.target.value })}
              placeholder="e.g. Sauce, Main…"
              className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
              disabled={loading}
            />
          </div>

          <div>
            <div className="text-xs font-semibold tracking-widest text-neutral-500">PORTIONS</div>
            <input
              value={recipe?.portions ?? ''}
              onChange={(e) => saveRecipe({ portions: numOrNull(e.target.value) })}
              placeholder="1"
              className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-neutral-700">Loading editor…</div>
        </div>
      )}

      {!loading && errorMsg && (
        <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-red-700">Editor error</div>
          <div className="mt-2 text-sm text-neutral-700">{errorMsg}</div>
        </div>
      )}

      {!loading && recipe && !errorMsg && (
        <>
          {/* Tabs */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-2 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <TabButton active={tab === 'ingredients'} onClick={() => setTab('ingredients')}>
                Ingredients
              </TabButton>
              <TabButton active={tab === 'steps'} onClick={() => setTab('steps')}>
                Steps
              </TabButton>
              <TabButton active={tab === 'pricing'} onClick={() => setTab('pricing')}>
                Pricing
              </TabButton>
              <TabButton active={tab === 'nutrition'} onClick={() => setTab('nutrition')}>
                Nutrition
              </TabButton>
              <TabButton active={tab === 'photos'} onClick={() => setTab('photos')}>
                Photos
              </TabButton>
            </div>
          </div>

          {tab === 'ingredients' && <IngredientsTab recipeId={recipe.id} kitchenId={recipe.kitchen_id} />}

          {tab === 'steps' && (
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold tracking-widest text-neutral-500">STEP BUILDER</div>
                  <div className="mt-1 text-lg font-extrabold text-neutral-900">Blocks</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadSteps}
                    className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={addStep}
                    className="rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    + Add Step
                  </button>
                </div>
              </div>

              {stepsLoading && <div className="mt-4 text-sm text-neutral-700">Loading steps…</div>}
              {!stepsLoading && stepsError && <div className="mt-4 text-sm text-red-700">{stepsError}</div>}

              {!stepsLoading && !stepsError && (
                <div className="mt-4 space-y-4">
                  {steps.length === 0 ? (
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-700">
                      No steps yet. Click <b>+ Add Step</b>.
                    </div>
                  ) : (
                    steps.map((s, i) => (
                      <div key={s.id} className="rounded-3xl border border-neutral-200 p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-900 text-sm font-extrabold text-white">
                              {i + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold tracking-widest text-neutral-500">
                                STEP {i + 1}
                                {stepsSavingId === s.id ? ' • Saving…' : ''}
                              </div>
                              <div className="mt-1 text-sm font-bold text-neutral-900">
                                {s.title?.trim() ? s.title : 'Untitled step'}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => moveStep(s.id, 'up')}
                              className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveStep(s.id, 'down')}
                              className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => deleteStep(s.id)}
                              className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                          <div className="md:col-span-2">
                            <div className="text-xs font-semibold tracking-widest text-neutral-500">TITLE</div>
                            <input
                              value={s.title || ''}
                              onChange={(e) => updateStep(s.id, { title: e.target.value })}
                              placeholder="e.g. Mix sauce"
                              className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
                            />
                          </div>

                          <div>
                            <div className="text-xs font-semibold tracking-widest text-neutral-500">
                              TIMER (seconds)
                            </div>
                            <input
                              value={s.timer_seconds ?? ''}
                              onChange={(e) => updateStep(s.id, { timer_seconds: numOrNull(e.target.value) })}
                              placeholder="e.g. 60"
                              className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="text-xs font-semibold tracking-widest text-neutral-500">INSTRUCTIONS</div>
                          <textarea
                            value={s.body || ''}
                            onChange={(e) => updateStep(s.id, { body: e.target.value })}
                            placeholder="Write this step..."
                            className="mt-2 min-h-[140px] w-full rounded-2xl border border-neutral-200 p-4 text-sm outline-none focus:border-neutral-400"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'pricing' && <PricingTab recipe={recipe} onSave={saveRecipe} />}
          {tab === 'nutrition' && <NutritionTab recipe={recipe} onSave={saveRecipe} />}
          {tab === 'photos' && <PhotosTab recipe={recipe} onSave={saveRecipe} />}
        </>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-2xl px-4 py-2 text-sm font-semibold transition',
        active ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-100'
      )}
    >
      {children}
    </button>
  )
}

/* Ingredients Tab (minimal stable viewer) */
type LineRow = {
  id: string
  ingredient_id: string
  qty: number | null
  unit: string | null
  note: string | null
  ingredients?: { name: string | null } | null
}

function IngredientsTab({ recipeId, kitchenId }: { recipeId: string; kitchenId: string }) {
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [lines, setLines] = useState<LineRow[]>([])

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      setErrorMsg('')

      try {
        const { data, error } = await supabase
          .from('recipe_lines')
          .select('id,ingredient_id,qty,unit,note, ingredients(name)')
          .eq('kitchen_id', kitchenId)
          .eq('recipe_id', recipeId)
          .order('created_at', { ascending: true })

        if (!alive) return
        if (error) throw error
        setLines((data || []) as any)
        setLoading(false)
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load ingredients lines.')
        setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [recipeId, kitchenId])

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold tracking-widest text-neutral-500">INGREDIENTS</div>
          <div className="mt-1 text-lg font-extrabold text-neutral-900">Recipe lines</div>
        </div>
        <div className="text-xs text-neutral-500">Next: add Add/Edit lines + auto-cost.</div>
      </div>

      {loading && <div className="mt-4 text-sm text-neutral-700">Loading lines…</div>}
      {!loading && errorMsg && <div className="mt-4 text-sm text-red-700">{errorMsg}</div>}

      {!loading && !errorMsg && (
        <div className="mt-4 space-y-3">
          {lines.length === 0 ? (
            <div className="text-sm text-neutral-600">No lines yet.</div>
          ) : (
            lines.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-neutral-900">{l.ingredients?.name || 'Ingredient'}</div>
                  <div className="mt-1 text-xs text-neutral-500">{l.note || ''}</div>
                </div>
                <div className="text-sm font-semibold text-neutral-800">
                  {l.qty ?? '—'} {l.unit || ''}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function PricingTab({ recipe, onSave }: { recipe: RecipeRow; onSave: (p: Partial<RecipeRow>) => void }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="text-xs font-semibold tracking-widest text-neutral-500">PRICING</div>
      <div className="mt-1 text-lg font-extrabold text-neutral-900">Premium pricing controls</div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <div className="text-xs font-semibold tracking-widest text-neutral-500">CURRENCY</div>
          <input
            value={recipe.currency || 'USD'}
            onChange={(e) => onSave({ currency: e.target.value })}
            className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </div>

        <div>
          <div className="text-xs font-semibold tracking-widest text-neutral-500">TARGET FOOD COST %</div>
          <input
            value={recipe.target_food_cost_pct ?? ''}
            onChange={(e) => onSave({ target_food_cost_pct: numOrNull(e.target.value) })}
            placeholder="30"
            className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </div>

        <div>
          <div className="text-xs font-semibold tracking-widest text-neutral-500">SELLING PRICE</div>
          <input
            value={recipe.selling_price ?? ''}
            onChange={(e) => onSave({ selling_price: numOrNull(e.target.value) })}
            placeholder="0"
            className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </div>
      </div>

      <div className="mt-4 text-sm text-neutral-600">
        Next: auto suggested price from computed recipe total cost.
      </div>
    </div>
  )
}

function NutritionTab({ recipe, onSave }: { recipe: RecipeRow; onSave: (p: Partial<RecipeRow>) => void }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="text-xs font-semibold tracking-widest text-neutral-500">NUTRITION</div>
      <div className="mt-1 text-lg font-extrabold text-neutral-900">Manual nutrition (for now)</div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Field label="Calories" value={recipe.calories} onChange={(v) => onSave({ calories: v })} />
        <Field label="Protein (g)" value={recipe.protein_g} onChange={(v) => onSave({ protein_g: v })} />
        <Field label="Carbs (g)" value={recipe.carbs_g} onChange={(v) => onSave({ carbs_g: v })} />
        <Field label="Fat (g)" value={recipe.fat_g} onChange={(v) => onSave({ fat_g: v })} />
      </div>
    </div>
  )
}

function PhotosTab({ recipe, onSave }: { recipe: RecipeRow; onSave: (p: Partial<RecipeRow>) => void }) {
  const urls = recipe.photo_urls || []

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold tracking-widest text-neutral-500">PHOTOS</div>
          <div className="mt-1 text-lg font-extrabold text-neutral-900">Recipe gallery</div>
        </div>
        <button
          onClick={() => onSave({ photo_urls: [...urls, ''] })}
          className="rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          + Add URL
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {urls.length === 0 ? (
          <div className="text-sm text-neutral-600">No photos yet. Add a URL.</div>
        ) : (
          urls.map((u, idx) => (
            <div key={idx} className="rounded-2xl border border-neutral-200 p-4">
              <div className="text-xs font-semibold tracking-widest text-neutral-500">PHOTO URL</div>
              <input
                value={u || ''}
                onChange={(e) => {
                  const next = [...urls]
                  next[idx] = e.target.value
                  onSave({ photo_urls: next })
                }}
                placeholder="https://…"
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
              />

              {u ? (
                <img
                  src={u}
                  alt="recipe"
                  className="mt-3 h-48 w-full rounded-2xl object-cover"
                  onError={(ev) => {
                    ;(ev.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="mt-3 rounded-2xl bg-neutral-100 p-6 text-sm text-neutral-600">
                  Paste a valid URL to preview.
                </div>
              )}

              <button
                onClick={() => {
                  const next = urls.filter((_, i) => i !== idx)
                  onSave({ photo_urls: next })
                }}
                className="mt-3 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-widest text-neutral-500">{label}</div>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(numOrNull(e.target.value))}
        className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
      />
    </div>
  )
}
