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
}

type Line = {
  recipe_id: string
  ingredient_id: string | null
  sub_recipe_id: string | null
  qty: number
  unit: string
}

type Ingredient = {
  id: string
  name?: string | null
  pack_unit?: string | null
  net_unit_cost?: number | null
  is_active?: boolean
}

function toNum(x: any, fallback = 0) {
  const n = Number(x)
  return Number.isFinite(n) ? n : fallback
}

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v)
}

function safeUnit(u: string) {
  const x = (u ?? '').trim().toLowerCase()
  return x || 'g'
}

function unitFamily(u: string) {
  const x = safeUnit(u)
  if (x === 'g' || x === 'kg') return 'mass'
  if (x === 'ml' || x === 'l') return 'volume'
  if (x === 'pcs') return 'count'
  if (x === 'portion') return 'portion'
  return 'other'
}

function convertQty(qty: number, fromUnit: string, toUnit: string) {
  const from = safeUnit(fromUnit)
  const to = safeUnit(toUnit)
  if (from === to) return { ok: true, value: qty }

  const ff = unitFamily(from)
  const tf = unitFamily(to)
  if (ff !== tf) return { ok: false, value: qty }

  if (ff === 'mass') {
    if (from === 'g' && to === 'kg') return { ok: true, value: qty / 1000 }
    if (from === 'kg' && to === 'g') return { ok: true, value: qty * 1000 }
  }
  if (ff === 'volume') {
    if (from === 'ml' && to === 'l') return { ok: true, value: qty / 1000 }
    if (from === 'l' && to === 'ml') return { ok: true, value: qty * 1000 }
  }
  return { ok: true, value: qty }
}

export default function RecipeEditor() {
  const location = useLocation()
  const [sp] = useSearchParams()
  const id = sp.get('id')

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])

  // add-line UI
  const [addOpen, setAddOpen] = useState(false)
  const [addIngredientId, setAddIngredientId] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addUnit, setAddUnit] = useState('g')
  const [saving, setSaving] = useState(false)

  const [toastMsg, setToastMsg] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastOpen(true)
  }

  const loadAll = async (recipeId: string) => {
    // recipe
    const { data: r, error: rErr } = await supabase
      .from('recipes')
      .select('id,kitchen_id,name,category,portions,yield_qty,yield_unit,is_subrecipe,is_archived')
      .eq('id', recipeId)
      .single()
    if (rErr) throw rErr

    // lines
    const { data: l, error: lErr } = await supabase
      .from('recipe_lines')
      .select('recipe_id,ingredient_id,sub_recipe_id,qty,unit')
      .eq('recipe_id', recipeId)
    if (lErr) throw lErr

    // ingredients
    const { data: i, error: iErr } = await supabase
      .from('ingredients')
      .select('id,name,pack_unit,net_unit_cost,is_active')
      .order('name', { ascending: true })
    if (iErr) throw iErr

    setRecipe(r as Recipe)
    setLines((l ?? []) as Line[])
    setIngredients((i ?? []) as Ingredient[])
  }

  useEffect(() => {
    console.log('[RecipeEditor] mounted:', location.pathname + location.search + location.hash)
  }, [location])

  useEffect(() => {
    const run = async () => {
      if (!id) {
        setErr('Missing recipe id in URL (?id=...)')
        setLoading(false)
        return
      }

      setLoading(true)
      setErr(null)
      try {
        await loadAll(id)
        setLoading(false)
      } catch (e: any) {
        setErr(e?.message ?? 'Unknown error')
        setLoading(false)
      }
    }
    run()
  }, [id])

  const ingById = useMemo(() => {
    const m = new Map<string, Ingredient>()
    for (const i of ingredients) m.set(i.id, i)
    return m
  }, [ingredients])

  const activeIngredients = useMemo(() => {
    return ingredients.filter((i) => i.is_active !== false)
  }, [ingredients])

  const totalCost = useMemo(() => {
    let sum = 0
    for (const l of lines) {
      const qty = toNum(l.qty, 0)
      if (l.ingredient_id) {
        const ing = ingById.get(l.ingredient_id)
        const packUnit = safeUnit(ing?.pack_unit ?? 'g')
        const net = toNum(ing?.net_unit_cost, 0)
        const conv = convertQty(qty, l.unit, packUnit)
        sum += conv.value * net
      }
    }
    return sum
  }, [lines, ingById])

  const addLine = async () => {
    if (!id) return
    if (!addIngredientId) return showToast('Pick an ingredient first')
    const qty = Math.max(0, toNum(addQty, 0))
    if (qty <= 0) return showToast('Qty must be > 0')

    setSaving(true)
    try {
      const payload = {
        recipe_id: id,
        ingredient_id: addIngredientId,
        sub_recipe_id: null,
        qty,
        unit: safeUnit(addUnit),
      }

      const { error } = await supabase.from('recipe_lines').insert(payload)
      if (error) throw error

      showToast('Line added ✅')
      setAddOpen(false)
      setAddIngredientId('')
      setAddQty('1')
      setAddUnit('g')

      await loadAll(id)
    } catch (e: any) {
      showToast(e?.message ?? 'Add failed')
    } finally {
      setSaving(false)
    }
  }

  const deleteLine = async (idx: number) => {
    if (!id) return
    const line = lines[idx]
    if (!line) return

    // We need a unique key to delete. If your table has an "id" column, use it instead.
    // For now we delete by matching all fields (works fine for MVP).
    try {
      const { error } = await supabase
        .from('recipe_lines')
        .delete()
        .eq('recipe_id', id)
        .eq('qty', line.qty)
        .eq('unit', line.unit)
        .is('sub_recipe_id', null)
        .eq('ingredient_id', line.ingredient_id)

      if (error) throw error
      showToast('Line deleted ✅')
      await loadAll(id)
    } catch (e: any) {
      showToast(e?.message ?? 'Delete failed')
    }
  }

  if (loading) return <div className="gc-card p-6">Loading editor…</div>

  if (err) {
    return (
      <div className="gc-card p-6 space-y-3">
        <div>
          <div className="gc-label">ERROR</div>
          <div className="mt-2 text-sm text-red-600">{err}</div>
        </div>
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
        <div>
          <div className="gc-label">NOT FOUND</div>
          <div className="mt-2 text-sm text-neutral-700">Recipe not found.</div>
        </div>
        <NavLink className="gc-btn gc-btn-primary" to="/recipes">
          Back to Recipes
        </NavLink>
      </div>
    )
  }

  const portions = Math.max(1, toNum(recipe.portions, 1))
  const cpp = totalCost / portions

  return (
    <div className="space-y-6">
      <div className="gc-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="gc-label">RECIPE EDITOR</div>
            <div className="mt-2 text-2xl font-extrabold">{recipe.name}</div>
            <div className="mt-2 text-sm text-neutral-600">
              {recipe.category ?? '—'} · Portions: {portions}
            </div>
            <div className="mt-2 text-xs text-neutral-500">ID: {recipe.id}</div>
            <div className="mt-2 text-xs text-neutral-500">
              Route: <span className="font-mono">{location.pathname + location.search}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="gc-label">COST PREVIEW</div>
            <div className="mt-1 text-xl font-extrabold">{money(totalCost)}</div>
            <div className="mt-1 text-xs text-neutral-500">
              Cost/portion: <span className="font-semibold">{money(cpp)}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="gc-btn gc-btn-primary" type="button" onClick={() => setAddOpen(true)}>
                + Add Line
              </button>
              <NavLink className="gc-btn gc-btn-ghost" to="/recipes">
                ← Back
              </NavLink>
            </div>
          </div>
        </div>
      </div>

      <div className="gc-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="gc-label">LINES</div>
          <button className="gc-btn gc-btn-ghost" type="button" onClick={() => setAddOpen(true)}>
            Add ingredient
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="mt-3 text-sm text-neutral-600">No lines yet. Add your first ingredient.</div>
        ) : (
          <div className="mt-4 space-y-2">
            {lines.map((l, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
              >
                <div className="text-sm">
                  <div className="font-semibold">
                    {l.ingredient_id ? (ingById.get(l.ingredient_id)?.name ?? 'Ingredient') : 'Sub-recipe line'}
                  </div>
                  <div className="text-xs text-neutral-500">
                    qty: {l.qty} {l.unit}
                  </div>
                </div>

                <button className="gc-btn gc-btn-ghost" type="button" onClick={() => deleteLine(idx)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[min(780px,92vw)] -translate-x-1/2 -translate-y-1/2">
            <div className="gc-card p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="gc-label">ADD LINE</div>
                  <div className="mt-1 text-xl font-extrabold">Ingredient</div>
                </div>
                <button className="gc-btn gc-btn-ghost" type="button" onClick={() => setAddOpen(false)}>
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="gc-label">INGREDIENT</div>
                  <select
                    className="gc-input mt-2 w-full"
                    value={addIngredientId}
                    onChange={(e) => setAddIngredientId(e.target.value)}
                  >
                    <option value="">Select ingredient…</option>
                    {activeIngredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name ?? i.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="gc-label">QTY</div>
                  <input
                    className="gc-input mt-2 w-full"
                    type="number"
                    min={0}
                    step="0.01"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                  />
                </div>

                <div>
                  <div className="gc-label">UNIT</div>
                  <input
                    className="gc-input mt-2 w-full"
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value)}
                    placeholder="g / kg / ml / l / pcs"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-2">
                  <button className="gc-btn gc-btn-ghost" type="button" onClick={() => setAddOpen(false)}>
                    Cancel
                  </button>
                  <button className="gc-btn gc-btn-primary" type="button" onClick={addLine} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast open={toastOpen} message={toastMsg} onClose={() => setToastOpen(false)} />
    </div>
  )
}
