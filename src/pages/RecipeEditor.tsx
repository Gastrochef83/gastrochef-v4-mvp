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
  return (u ?? '').trim().toLowerCase() || 'g'
}

function unitFamily(u: string) {
  const x = safeUnit(u)
  if (x === 'g' || x === 'kg') return 'mass'
  if (x === 'ml' || x === 'l') return 'volume'
  if (x === 'pcs') return 'count'
  return 'other'
}

function convertQty(qty: number, fromUnit: string, toUnit: string) {
  const from = safeUnit(fromUnit)
  const to = safeUnit(toUnit)
  if (from === to) return qty
  if (unitFamily(from) !== unitFamily(to)) return qty

  if (from === 'g' && to === 'kg') return qty / 1000
  if (from === 'kg' && to === 'g') return qty * 1000
  if (from === 'ml' && to === 'l') return qty / 1000
  if (from === 'l' && to === 'ml') return qty * 1000

  return qty
}

function extFromType(mime: string) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
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

  const [addOpen, setAddOpen] = useState(false)
  const [addIngredientId, setAddIngredientId] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addUnit, setAddUnit] = useState('g')
  const [saving, setSaving] = useState(false)

  const [uploading, setUploading] = useState(false)

  const [toastMsg, setToastMsg] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const showToast = (m: string) => {
    setToastMsg(m)
    setToastOpen(true)
  }

  const loadAll = async (recipeId: string) => {
    const { data: r, error: rErr } = await supabase
      .from('recipes')
      .select('id,kitchen_id,name,category,portions,yield_qty,yield_unit,is_subrecipe,is_archived,photo_url')
      .eq('id', recipeId)
      .single()
    if (rErr) throw rErr

    const { data: l } = await supabase
      .from('recipe_lines')
      .select('recipe_id,ingredient_id,sub_recipe_id,qty,unit')
      .eq('recipe_id', recipeId)

    const { data: i } = await supabase
      .from('ingredients')
      .select('id,name,pack_unit,net_unit_cost,is_active')
      .order('name')

    setRecipe(r as Recipe)
    setLines((l ?? []) as Line[])
    setIngredients((i ?? []) as Ingredient[])
  }

  useEffect(() => {
    if (!id) {
      setErr('Missing recipe id')
      setLoading(false)
      return
    }
    loadAll(id).then(() => setLoading(false)).catch(e => {
      setErr(e.message)
      setLoading(false)
    })
  }, [id])

  const ingById = useMemo(() => {
    const m = new Map<string, Ingredient>()
    ingredients.forEach(i => m.set(i.id, i))
    return m
  }, [ingredients])

  const totalCost = useMemo(() => {
    let sum = 0
    for (const l of lines) {
      if (!l.ingredient_id) continue
      const ing = ingById.get(l.ingredient_id)
      const net = toNum(ing?.net_unit_cost, 0)
      const packUnit = safeUnit(ing?.pack_unit)
      const qty = convertQty(toNum(l.qty), l.unit, packUnit)
      sum += qty * net
    }
    return sum
  }, [lines, ingById])

  const uploadPhoto = async (file: File) => {
    if (!id) return
    setUploading(true)
    try {
      const key = `recipes/${id}/${Date.now()}.${extFromType(file.type)}`
      const { error } = await supabase.storage.from('recipe-photos').upload(key, file, { upsert: true })
      if (error) throw error

      const { data } = supabase.storage.from('recipe-photos').getPublicUrl(key)
      await supabase.from('recipes').update({ photo_url: data.publicUrl }).eq('id', id)

      showToast('Photo uploaded ✅')
      await loadAll(id)
    } catch (e:any) {
      showToast(e.message)
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="gc-card p-6">Loading…</div>
  if (err || !recipe) return <div className="gc-card p-6">{err}</div>

  const portions = Math.max(1, recipe.portions || 1)

  return (
    <div className="space-y-6">

      <div className="gc-card p-6 flex gap-4 items-start">
        <div className="h-28 w-28 rounded-2xl overflow-hidden border bg-neutral-100">
          {recipe.photo_url
            ? <img src={recipe.photo_url} className="w-full h-full object-cover"/>
            : <div className="flex h-full items-center justify-center text-xs">No Photo</div>}
        </div>

        <div className="flex-1">
          <div className="text-2xl font-extrabold">{recipe.name}</div>
          <div className="text-sm text-neutral-500">{recipe.category}</div>

          <label className="gc-btn gc-btn-ghost mt-3 cursor-pointer">
            {uploading ? 'Uploading…' : 'Upload Photo'}
            <input hidden type="file" accept="image/*"
              onChange={e=>{
                const f=e.target.files?.[0]
                if(f) uploadPhoto(f)
              }}/>
          </label>
        </div>

        <div className="text-right">
          <div className="text-xl font-extrabold">{money(totalCost)}</div>
          <div className="text-xs">Per portion: {money(totalCost/portions)}</div>
        </div>
      </div>

      <Toast open={toastOpen} message={toastMsg} onClose={()=>setToastOpen(false)} />
    </div>
  )
}
