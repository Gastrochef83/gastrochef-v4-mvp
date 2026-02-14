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
  method?: string | null
  method_steps?: string[] | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  selling_price?: number | null
  currency?: string | null
  target_food_cost_pct?: number | null
}

type Line = {
  id: string
  recipe_id: string
  ingredient_id: string | null
  sub_recipe_id: string | null
  qty: number
  unit: string
  note: string | null
  sort_order: number
  line_type: 'ingredient' | 'group'
  group_title: string | null
}

type Ingredient = {
  id: string
  name?: string | null
  pack_unit?: string | null
  net_unit_cost?: number | null
  is_active?: boolean
  kcal_per_100g?: number | null
  protein_per_100g?: number | null
  carbs_per_100g?: number | null
  fat_per_100g?: number | null
  density_g_per_ml?: number | null
  grams_per_piece?: number | null
}

function toNum(x: any, fallback = 0) {
  const n = Number(x)
  return Number.isFinite(n) ? n : fallback
}
function safeUnit(u: string) {
  return (u ?? '').trim().toLowerCase() || 'g'
}
function normalizeSteps(steps: string[] | null | undefined) {
  return (steps ?? []).map((s) => (s ?? '').trim()).filter(Boolean)
}
function extFromType(mime: string) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}
function fmtMoney(n: number, currency: string) {
  const v = Number.isFinite(n) ? n : 0
  const cur = (currency || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(v)
  } catch {
    return `${v.toFixed(2)} ${cur}`
  }
}
function convertQtyToPackUnit(qty: number, lineUnit: string, packUnit: string) {
  const u = safeUnit(lineUnit)
  const p = safeUnit(packUnit)

  let conv = qty
  if (u === 'g' && p === 'kg') conv = qty / 1000
  else if (u === 'kg' && p === 'g') conv = qty * 1000
  else if (u === 'ml' && p === 'l') conv = qty / 1000
  else if (u === 'l' && p === 'ml') conv = qty * 1000

  return conv
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

  // Meta saving
  const [savingMeta, setSavingMeta] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [portions, setPortions] = useState('1')
  const [description, setDescription] = useState('')

  // Steps
  const [steps, setSteps] = useState<string[]>([])
  const [newStep, setNewStep] = useState('')
  const [methodLegacy, setMethodLegacy] = useState('')

  // Nutrition per portion (manual only)
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')

  // Pricing per portion
  const [currency, setCurrency] = useState('USD')
  const [sellingPrice, setSellingPrice] = useState('')
  const [targetFC, setTargetFC] = useState('30')

  // Toast
  const [toastMsg, setToastMsg] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastOpen(true)
  }

  // Inline Add (no modal)
  const [addIngredientId, setAddIngredientId] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addUnit, setAddUnit] = useState('g')
  const [addNote, setAddNote] = useState('')
  const [savingAdd, setSavingAdd] = useState(false)
  const [ingSearch, setIngSearch] = useState('')

  // Add Group
  const [groupTitle, setGroupTitle] = useState('')
  const [savingGroup, setSavingGroup] = useState(false)

  // Inline edit per row
  const [edit, setEdit] = useState<
    Record<
      string,
      {
        ingredient_id: string
        qty: string
        unit: string
        note: string
        group_title: string
      }
    >
  >({})
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({})
  const [reorderSaving, setReorderSaving] = useState(false)

  const loadAll = async (recipeId: string) => {
    const { data: r, error: rErr } = await supabase
      .from('recipes')
      .select(
        'id,kitchen_id,name,category,portions,yield_qty,yield_unit,is_subrecipe,is_archived,photo_url,description,method,method_steps,calories,protein_g,carbs_g,fat_g,selling_price,currency,target_food_cost_pct'
      )
      .eq('id', recipeId)
      .single()
    if (rErr) throw rErr

    const { data: l, error: lErr } = await supabase
      .from('recipe_lines')
      .select('id,recipe_id,ingredient_id,sub_recipe_id,qty,unit,note,sort_order,line_type,group_title')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
    if (lErr) throw lErr

    const { data: i, error: iErr } = await supabase
      .from('ingredients')
      .select('id,name,pack_unit,net_unit_cost,is_active')
      .order('name', { ascending: true })
    if (iErr) throw iErr

    const rr = r as Recipe
    const ll = (l ?? []) as Line[]

    setRecipe(rr)
    setLines(ll)
    setIngredients((i ?? []) as Ingredient[])

    setName(rr.name ?? '')
    setCategory(rr.category ?? '')
    setPortions(String(rr.portions ?? 1))
    setDescription(rr.description ?? '')
    setSteps(normalizeSteps(rr.method_steps))
    setMethodLegacy(rr.method ?? '')

    setCalories(rr.calories == null ? '' : String(rr.calories))
    setProtein(rr.protein_g == null ? '' : String(rr.protein_g))
    setCarbs(rr.carbs_g == null ? '' : String(rr.carbs_g))
    setFat(rr.fat_g == null ? '' : String(rr.fat_g))

    setCurrency((rr.currency ?? 'USD').toUpperCase())
    setSellingPrice(rr.selling_price == null ? '' : String(rr.selling_price))
    setTargetFC(rr.target_food_cost_pct == null ? '30' : String(rr.target_food_cost_pct))

    const m: any = {}
    for (const x of ll) {
      m[x.id] = {
        ingredient_id: x.ingredient_id ?? '',
        qty: String(x.qty ?? 0),
        unit: safeUnit(x.unit ?? 'g'),
        note: x.note ?? '',
        group_title: x.group_title ?? '',
      }
    }
    setEdit(m)
  }

  useEffect(() => {
    if (!id) {
      setErr('Missing recipe id in URL (?id=...)')
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    loadAll(id)
      .then(() => setLoading(false))
      .catch((e: any) => {
        setErr(e?.message ?? 'Unknown error')
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const ingById = useMemo(() => {
    const m = new Map<string, Ingredient>()
    for (const i of ingredients) m.set(i.id, i)
    return m
  }, [ingredients])

  const activeIngredients = useMemo(() => ingredients.filter((i) => i.is_active !== false), [ingredients])

  const filteredIngredients = useMemo(() => {
    const q = ingSearch.trim().toLowerCase()
    if (!q) return activeIngredients
    return activeIngredients.filter((x) => (x.name ?? '').toLowerCase().includes(q))
  }, [activeIngredients, ingSearch])

  // Total cost uses ingredient rows only
  const totalCost = useMemo(() => {
    let sum = 0
    for (const l of lines) {
      if (l.line_type !== 'ingredient') continue
      if (!l.ingredient_id) continue
      const ing = ingById.get(l.ingredient_id)
      const net = toNum(ing?.net_unit_cost, 0)
      const packUnit = safeUnit(ing?.pack_unit ?? 'g')
      const conv = convertQtyToPackUnit(toNum(l.qty, 0), l.unit, packUnit)
      sum += conv * net
    }
    return sum
  }, [lines, ingById])

  const portionsN = Math.max(1, toNum(portions, 1))
  const cpp = totalCost / portionsN

  const sell = Math.max(0, toNum(sellingPrice, 0))
  const fcPct = sell > 0 ? (cpp / sell) * 100 : null
  const margin = sell - cpp
  const marginPct = sell > 0 ? (margin / sell) * 100 : null

  const target = Math.min(99, Math.max(1, toNum(targetFC, 30)))
  const suggestedPrice = target > 0 ? cpp / (target / 100) : 0

  const applySuggested = () => {
    if (!Number.isFinite(suggestedPrice) || suggestedPrice <= 0) return
    setSellingPrice(String(Math.round(suggestedPrice * 100) / 100))
    showToast('Suggested price applied ✅ (remember Save)')
  }

  const saveMeta = async () => {
    if (!id) return
    setSavingMeta(true)
    try {
      const payload = {
        name: name.trim() || 'Untitled',
        category: category.trim() || null,
        portions: Math.max(1, toNum(portions, 1)),
        description: description.trim() || null,

        method_steps: normalizeSteps(steps),
        method: methodLegacy.trim() || null,

        calories: calories.trim() === '' ? null : Math.max(0, Math.floor(toNum(calories, 0))),
        protein_g: protein.trim() === '' ? null : Math.max(0, toNum(protein, 0)),
        carbs_g: carbs.trim() === '' ? null : Math.max(0, toNum(carbs, 0)),
        fat_g: fat.trim() === '' ? null : Math.max(0, toNum(fat, 0)),

        currency: (currency || 'USD').toUpperCase(),
        selling_price: sellingPrice.trim() === '' ? null : Math.max(0, toNum(sellingPrice, 0)),
        target_food_cost_pct: Math.min(99, Math.max(1, toNum(targetFC, 30))),
      }

      const { error } = await supabase.from('recipes').update(payload).eq('id', id)
      if (error) throw error

      showToast('Saved ✅')
      await loadAll(id)
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed')
    } finally {
      setSavingMeta(false)
    }
  }

  // Step builder
  const addStep = () => {
    const s = newStep.trim()
    if (!s) return
    setSteps((prev) => [...prev, s])
    setNewStep('')
  }
  const updateStep = (idx: number, value: string) => setSteps((prev) => prev.map((x, i) => (i === idx ? value : x)))
  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx))
  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  const uploadPhoto = async (file: File) => {
    if (!id) return
    setUploading(true)
    try {
      const ext = extFromType(file.type)
      const key = `recipes/${id}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage.from('recipe-photos').upload(key, file, {
        upsert: true,
        contentType: file.type,
      })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('recipe-photos').getPublicUrl(key)
      const url = pub?.publicUrl
      if (!url) throw new Error('Failed to get public url')

      const { error: updErr } = await supabase.from('recipes').update({ photo_url: url }).eq('id', id)
      if (updErr) throw updErr

      showToast('Photo updated ✅')
      await loadAll(id)
    } catch (e: any) {
      showToast(e?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Inline Add ingredient (no modal)
  const addLineInline = async () => {
    if (!id) return
    if (!addIngredientId) return showToast('Pick an ingredient first')
    const qty = Math.max(0, toNum(addQty, 0))
    if (qty <= 0) return showToast('Qty must be > 0')

    setSavingAdd(true)
    try {
      const maxSort = lines.length ? Math.max(...lines.map((x) => toNum(x.sort_order, 0))) : 0
      const payload = {
        recipe_id: id,
        ingredient_id: addIngredientId,
        sub_recipe_id: null,
        qty,
        unit: safeUnit(addUnit),
        note: addNote.trim() || null,
        sort_order: maxSort + 10,
        line_type: 'ingredient',
        group_title: null,
      }
      const { error } = await supabase.from('recipe_lines').insert(payload)
      if (error) throw error

      setAddIngredientId('')
      setAddQty('1')
      setAddUnit('g')
      setAddNote('')
      setIngSearch('')
      showToast('Ingredient added ✅')
      await loadAll(id)
    } catch (e: any) {
      showToast(e?.message ?? 'Add failed')
    } finally {
      setSavingAdd(false)
    }
  }

  // Add group header row
  const addGroup = async () => {
    if (!id) return
    const title = groupTitle.trim()
    if (!title) return showToast('Write group title first')

    setSavingGroup(true)
    try {
      const maxSort = lines.length ? Math.max(...lines.map((x) => toNum(x.sort_order, 0))) : 0
      const payload = {
        recipe_id: id,
        ingredient_id: null,
        sub_recipe_id: null,
        qty: 0,
        unit: 'g',
        note: null,
        sort_order: maxSort + 10,
        line_type: 'group',
        group_title: title,
      }
      const { error } = await supabase.from('recipe_lines').insert(payload)
      if (error) throw error

      setGroupTitle('')
      showToast('Group added ✅')
      await loadAll(id)
    } catch (e: any) {
      showToast(e?.message ?? 'Add group failed')
    } finally {
      setSavingGroup(false)
    }
  }

  const saveRow = async (lineId: string) => {
    if (!id) return
    const row = edit[lineId]
    if (!row) return

    setRowSaving((p) => ({ ...p, [lineId]: true }))
    try {
      const current = lines.find((x) => x.id === lineId)
      if (!current) throw new Error('Line not found')

      if (current.line_type === 'group') {
        const title = row.group_title.trim()
        if (!title) throw new Error('Group title required')
        const { error } = await supabase
          .from('recipe_lines')
          .update({ group_title: title })
          .eq('id', lineId)
          .eq('recipe_id', id)
        if (error) throw error
        showToast('Group saved ✅')
        await loadAll(id)
        return
      }

      const ingredient_id = row.ingredient_id || null
      const qty = Math.max(0, toNum(row.qty, 0))
      const unit = safeUnit(row.unit || 'g')
      const note = row.note.trim() || null

      if (!ingredient_id) throw new Error('Pick an ingredient')
      if (qty <= 0) throw new Error('Qty must be > 0')

      const { error } = await supabase
        .from('recipe_lines')
        .update({ ingredient_id, qty, unit, note })
        .eq('id', lineId)
        .eq('recipe_id', id)
      if (error) throw error

      showToast('Line saved ✅')
      await loadAll(id)
    } catch (e: any) {
      showToast(e?.message ?? 'Save line failed')
    } finally {
      setRowSaving((p) => ({ ...p, [lineId]: false }))
    }
  }

  const deleteLine = async (lineId: string) => {
    if (!id) return
    try {
      const { error } = await supabase.from('recipe_lines').delete().eq('id', lineId).eq('recipe_id', id)
      if (error) throw error
      showToast('Deleted ✅')
      await loadAll(id)
    } catch (e: any) {
      showToast(e?.message ?? 'Delete failed')
    }
  }

  const duplicateLine = async (lineId: string) => {
    if (!id) return
    try {
      const src = lines.find((x) => x.id === lineId)
      if (!src) return
      const payload =
        src.line_type === 'group'
          ? {
              recipe_id: id,
              ingredient_id: null,
              sub_recipe_id: null,
              qty: 0,
              unit: 'g',
              note: null,
              line_type: 'group',
              group_title: (src.group_title ?? 'Group').trim(),
              sort_order: toNum(src.sort_order, 0) + 5,
            }
          : {
              recipe_id: id,
              ingredient_id: src.ingredient_id,
              sub_recipe_id: null,
              qty: src.qty,
              unit: safeUnit(src.unit),
              note: src.note,
              line_type: 'ingredient',
              group_title: null,
              sort_order: toNum(src.sort_order, 0) + 5,
            }

      const { error } = await supabase.from('recipe_lines').insert(payload as any)
      if (error) throw error
      showToast('Duplicated ✅')
      await loadAll(id)
    } catch (e: any) {
      showToast(e?.message ?? 'Duplicate failed')
    }
  }

  // Reorder: move in UI then persist sort_order
  const persistOrder = async (ordered: Line[]) => {
    if (!id) return
    setReorderSaving(true)
    try {
      // Give nice gaps: 10,20,30...
      const updates = ordered.map((x, idx) => ({ id: x.id, sort_order: (idx + 1) * 10 }))
      const tasks = updates.map((u) =>
        supabase.from('recipe_lines').update({ sort_order: u.sort_order }).eq('id', u.id).eq('recipe_id', id)
      )
      const results = await Promise.all(tasks)
      const bad = results.find((r) => r.error)
      if (bad?.error) throw bad.error
      showToast('Order saved ✅')
      await loadAll(id)
    } catch (e: any) {
      showToast(e?.message ?? 'Reorder failed')
    } finally {
      setReorderSaving(false)
    }
  }

  const moveLine = async (lineId: string, dir: -1 | 1) => {
    const idx = lines.findIndex((x) => x.id === lineId)
    if (idx < 0) return
    const j = idx + dir
    if (j < 0 || j >= lines.length) return
    const next = [...lines]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setLines(next)
    await persistOrder(next)
  }

  if (loading) return <div className="gc-card p-6">Loading editor…</div>
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
      {/* Header */}
      <div className="gc-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-28 w-28 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
              {recipe.photo_url ? (
                <img src={recipe.photo_url} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">No Photo</div>
              )}
            </div>

            <div className="min-w-[min(560px,92vw)]">
              <div className="gc-label">RECIPE EDITOR (MANUAL NUTRITION + PRICING)</div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="gc-label">NAME</div>
                  <input className="gc-input mt-2 w-full" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div>
                  <div className="gc-label">CATEGORY</div>
                  <input
                    className="gc-input mt-2 w-full"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Veg / Chicken / Dessert..."
                  />
                </div>

                <div>
                  <div className="gc-label">PORTIONS</div>
                  <input className="gc-input mt-2 w-full" type="number" min={1} step="1" value={portions} onChange={(e) => setPortions(e.target.value)} />
                </div>

                <div className="flex items-end gap-2">
                  <label className="gc-btn gc-btn-ghost cursor-pointer">
                    {uploading ? 'Uploading…' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const ff = e.target.files?.[0]
                        if (ff) uploadPhoto(ff)
                        e.currentTarget.value = ''
                      }}
                      disabled={uploading}
                    />
                  </label>

                  <button className="gc-btn gc-btn-primary" onClick={saveMeta} disabled={savingMeta}>
                    {savingMeta ? 'Saving…' : 'Save'}
                  </button>

                  <NavLink className="gc-btn gc-btn-ghost" to="/recipes">
                    ← Back
                  </NavLink>
                </div>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="gc-label">COST</div>
            <div className="mt-1 text-2xl font-extrabold">{fmtMoney(totalCost, currency)}</div>
            <div className="mt-1 text-xs text-neutral-500">
              Cost/portion: <span className="font-semibold">{fmtMoney(cpp, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Description */}
        <div className="gc-card p-6">
          <div className="gc-label">DESCRIPTION</div>
          <textarea className="gc-input mt-3 w-full min-h-[140px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short premium description for menu / customers..." />
        </div>

        {/* Nutrition (manual only) */}
        <div className="gc-card p-6">
          <div>
            <div className="gc-label">NUTRITION (PER PORTION)</div>
            <div className="mt-1 text-xs text-neutral-500">Manual input only.</div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="gc-label">CALORIES</div>
              <input className="gc-input mt-2 w-full" type="number" min={0} step="1" value={calories} onChange={(e) => setCalories(e.target.value)} />
            </div>
            <div>
              <div className="gc-label">PROTEIN (g)</div>
              <input className="gc-input mt-2 w-full" type="number" min={0} step="0.1" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </div>
            <div>
              <div className="gc-label">CARBS (g)</div>
              <input className="gc-input mt-2 w-full" type="number" min={0} step="0.1" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </div>
            <div>
              <div className="gc-label">FAT (g)</div>
              <input className="gc-input mt-2 w-full" type="number" min={0} step="0.1" value={fat} onChange={(e) => setFat(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Pricing Premium */}
        <div className="gc-card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="gc-label">PRICING PREMIUM (PER PORTION)</div>
              <div className="mt-1 text-sm text-neutral-600">Food Cost% + Margin + Suggested Price from target.</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="gc-btn gc-btn-ghost" type="button" onClick={applySuggested}>
                Apply Suggested
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div>
              <div className="gc-label">CURRENCY</div>
              <input className="gc-input mt-2 w-full" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="USD" />
            </div>
            <div>
              <div className="gc-label">SELLING PRICE</div>
              <input className="gc-input mt-2 w-full" type="number" min={0} step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="e.g., 8.50" />
            </div>
            <div>
              <div className="gc-label">TARGET FOOD COST %</div>
              <input className="gc-input mt-2 w-full" type="number" min={1} max={99} step="1" value={targetFC} onChange={(e) => setTargetFC(e.target.value)} placeholder="30" />
            </div>
            <div>
              <div className="gc-label">SUGGESTED PRICE</div>
              <div className="gc-input mt-2 w-full flex items-center">
                <span className="font-extrabold">{fmtMoney(suggestedPrice || 0, currency)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="gc-kpi">
              <div className="gc-kpi-label">Food Cost %</div>
              <div className="gc-kpi-value">{fcPct == null ? '—' : `${Math.round(fcPct * 10) / 10}%`}</div>
            </div>
            <div className="gc-kpi">
              <div className="gc-kpi-label">Margin / portion</div>
              <div className="gc-kpi-value">{sell > 0 ? fmtMoney(margin, currency) : '—'}</div>
            </div>
            <div className="gc-kpi">
              <div className="gc-kpi-label">Margin %</div>
              <div className="gc-kpi-value">{marginPct == null ? '—' : `${Math.round(marginPct * 10) / 10}%`}</div>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            After setting price/target, press <span className="font-semibold">Save</span> to store pricing in DB.
          </div>
        </div>
      </div>

      {/* Step Builder */}
      <div className="gc-card p-6">
        <div className="gc-label">STEP BUILDER</div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="gc-input"
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            placeholder="Write step…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addStep()
              }
            }}
          />
          <button className="gc-btn gc-btn-primary" type="button" onClick={addStep}>
            + Add Step
          </button>
        </div>

        {steps.length === 0 ? (
          <div className="mt-4 text-sm text-neutral-600">No steps yet.</div>
        ) : (
          <div className="mt-4 space-y-2">
            {steps.map((s, idx) => (
              <div key={idx} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="gc-label">STEP {idx + 1}</div>
                  <div className="flex gap-2">
                    <button className="gc-btn gc-btn-ghost" type="button" onClick={() => moveStep(idx, -1)}>
                      ↑
                    </button>
                    <button className="gc-btn gc-btn-ghost" type="button" onClick={() => moveStep(idx, 1)}>
                      ↓
                    </button>
                    <button className="gc-btn gc-btn-ghost" type="button" onClick={() => removeStep(idx)}>
                      Remove
                    </button>
                  </div>
                </div>

                <textarea className="gc-input mt-3 w-full min-h-[90px]" value={s} onChange={(e) => updateStep(idx, e.target.value)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* INGREDIENTS PRO */}
      <div className="gc-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="gc-label">INGREDIENTS</div>
            <div className="mt-1 text-sm text-neutral-600">Inline add · Group headers · Notes · Reorder · Duplicate.</div>
          </div>

          <div className="flex gap-2">
            <button className="gc-btn gc-btn-ghost" type="button" onClick={() => loadAll(id!)}>
              Refresh
            </button>
            <div className="text-xs text-neutral-500 flex items-center">{reorderSaving ? 'Saving order…' : ''}</div>
          </div>
        </div>

        {/* Inline Add + Add Group */}
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_.5fr_.5fr_1fr_auto]">
          <div>
            <div className="gc-label">SEARCH</div>
            <input className="gc-input mt-2 w-full" value={ingSearch} onChange={(e) => setIngSearch(e.target.value)} placeholder="Filter ingredients…" />
          </div>

          <div className="lg:col-span-2">
            <div className="gc-label">INGREDIENT</div>
            <select className="gc-input mt-2 w-full" value={addIngredientId} onChange={(e) => setAddIngredientId(e.target.value)}>
              <option value="">Select ingredient…</option>
              {filteredIngredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name ?? i.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="gc-label">QTY + UNIT</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input className="gc-input" type="number" min={0} step="0.01" value={addQty} onChange={(e) => setAddQty(e.target.value)} />
              <select className="gc-input" value={safeUnit(addUnit)} onChange={(e) => setAddUnit(e.target.value)}>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="l">l</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
          </div>

          <div>
            <div className="gc-label">NOTE</div>
            <input className="gc-input mt-2 w-full" value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="optional…" />
          </div>

          <div className="flex items-end">
            <button className="gc-btn gc-btn-primary w-full" type="button" onClick={addLineInline} disabled={savingAdd}>
              {savingAdd ? 'Saving…' : '+ Add'}
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="gc-label">ADD GROUP HEADER</div>
            <input className="gc-input mt-2 w-full" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="e.g., Sauce / Filling / Topping" />
          </div>
          <div className="flex items-end">
            <button className="gc-btn gc-btn-ghost w-full" type="button" onClick={addGroup} disabled={savingGroup}>
              {savingGroup ? 'Saving…' : '+ Add Group'}
            </button>
          </div>
        </div>

        {/* Table */}
        {lines.length === 0 ? (
          <div className="mt-4 text-sm text-neutral-600">No lines yet.</div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="grid grid-cols-[1.4fr_.5fr_.5fr_1fr_1fr] gap-0 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              <div>Item</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Unit</div>
              <div>Note</div>
              <div className="text-right">Actions</div>
            </div>

            <div className="divide-y divide-neutral-200">
              {lines.map((l) => {
                const e =
                  edit[l.id] ?? ({
                    ingredient_id: l.ingredient_id ?? '',
                    qty: String(l.qty ?? 0),
                    unit: safeUnit(l.unit ?? 'g'),
                    note: l.note ?? '',
                    group_title: l.group_title ?? '',
                  } as any)

                const ing = l.line_type === 'ingredient' && e.ingredient_id ? ingById.get(e.ingredient_id) : undefined
                const net = toNum(ing?.net_unit_cost, 0)
                const packUnit = safeUnit(ing?.pack_unit ?? 'g')
                const qtyN = toNum(e.qty, 0)
                const conv = l.line_type === 'ingredient' ? convertQtyToPackUnit(qtyN, e.unit, packUnit) : 0
                const lineCost = l.line_type === 'ingredient' ? conv * net : 0

                const saving = rowSaving[l.id] === true

                // GROUP ROW
                if (l.line_type === 'group') {
                  return (
                    <div key={l.id} className="px-4 py-3 bg-neutral-50">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex-1 min-w-[260px]">
                          <div className="gc-label">GROUP</div>
                          <input
                            className="gc-input mt-2 w-full font-semibold"
                            value={e.group_title}
                            onChange={(ev) => setEdit((p) => ({ ...p, [l.id]: { ...e, group_title: ev.target.value } }))}
                            placeholder="Group title…"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button className="gc-btn gc-btn-ghost" type="button" onClick={() => moveLine(l.id, -1)} disabled={reorderSaving}>
                            ↑
                          </button>
                          <button className="gc-btn gc-btn-ghost" type="button" onClick={() => moveLine(l.id, 1)} disabled={reorderSaving}>
                            ↓
                          </button>
                          <button className="gc-btn gc-btn-ghost" type="button" onClick={() => duplicateLine(l.id)}>
                            Duplicate
                          </button>
                          <button className="gc-btn gc-btn-primary" type="button" onClick={() => saveRow(l.id)} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button className="gc-btn gc-btn-ghost" type="button" onClick={() => deleteLine(l.id)} disabled={saving}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                // INGREDIENT ROW
                return (
                  <div key={l.id} className="grid grid-cols-[1.4fr_.5fr_.5fr_1fr_1fr] items-center gap-0 px-4 py-3">
                    <div className="pr-3">
                      <select
                        className="gc-input w-full"
                        value={e.ingredient_id}
                        onChange={(ev) => setEdit((p) => ({ ...p, [l.id]: { ...e, ingredient_id: ev.target.value } }))}
                      >
                        <option value="">Select…</option>
                        {activeIngredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name ?? i.id}
                          </option>
                        ))}
                      </select>

                      <div className="mt-1 text-[11px] text-neutral-500 flex items-center justify-between">
                        <span>
                          Pack: <span className="font-semibold">{packUnit.toUpperCase()}</span> · Unit Cost:{' '}
                          <span className="font-semibold">{fmtMoney(net, currency)}</span>
                        </span>
                        <span className="font-semibold">{fmtMoney(lineCost, currency)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <input
                        className="gc-input w-full text-right"
                        type="number"
                        min={0}
                        step="0.01"
                        value={e.qty}
                        onChange={(ev) => setEdit((p) => ({ ...p, [l.id]: { ...e, qty: ev.target.value } }))}
                      />
                    </div>

                    <div className="text-right">
                      <select
                        className="gc-input w-full text-right"
                        value={safeUnit(e.unit)}
                        onChange={(ev) => setEdit((p) => ({ ...p, [l.id]: { ...e, unit: ev.target.value } }))}
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="l">l</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>

                    <div className="pl-2">
                      <input
                        className="gc-input w-full"
                        value={e.note}
                        onChange={(ev) => setEdit((p) => ({ ...p, [l.id]: { ...e, note: ev.target.value } }))}
                        placeholder="e.g., chopped / room temp / to taste…"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button className="gc-btn gc-btn-ghost" type="button" onClick={() => moveLine(l.id, -1)} disabled={reorderSaving}>
                        ↑
                      </button>
                      <button className="gc-btn gc-btn-ghost" type="button" onClick={() => moveLine(l.id, 1)} disabled={reorderSaving}>
                        ↓
                      </button>
                      <button className="gc-btn gc-btn-ghost" type="button" onClick={() => duplicateLine(l.id)}>
                        Duplicate
                      </button>
                      <button className="gc-btn gc-btn-primary" type="button" onClick={() => saveRow(l.id)} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button className="gc-btn gc-btn-ghost" type="button" onClick={() => deleteLine(l.id)} disabled={saving}>
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <Toast open={toastOpen} message={toastMsg} onClose={() => setToastOpen(false)} />
    </div>
  )
}
