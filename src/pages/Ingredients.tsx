import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Ingredient = {
  id: string
  name: string
  category: string | null
  supplier: string | null
  pack_size: number
  pack_unit: string
  pack_price: number
  yield_percent: number
  net_unit_cost: number
}

function toNum(s: string, fallback = 0) {
  const n = Number(s)
  return Number.isFinite(n) ? n : fallback
}

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v)
}

export default function Ingredients() {
  const [kitchenId, setKitchenId] = useState<string | null>(null)

  const [items, setItems] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [supplier, setSupplier] = useState('')
  const [packSize, setPackSize] = useState('1')
  const [packUnit, setPackUnit] = useState('kg')
  const [packPrice, setPackPrice] = useState('0')
  const [yieldPercent, setYieldPercent] = useState('100')

  const resetForm = () => {
    setName('')
    setCategory('')
    setSupplier('')
    setPackSize('1')
    setPackUnit('kg')
    setPackPrice('0')
    setYieldPercent('100')
  }

  const openCreate = () => {
    setEditing(null)
    resetForm()
    setOpen(true)
  }

  const openEdit = (i: Ingredient) => {
    setEditing(i)
    setName(i.name)
    setCategory(i.category ?? '')
    setSupplier(i.supplier ?? '')
    setPackSize(String(i.pack_size))
    setPackUnit(i.pack_unit)
    setPackPrice(String(i.pack_price))
    setYieldPercent(String(i.yield_percent))
    setOpen(true)
  }

  const loadKitchen = async () => {
    const { data, error } = await supabase.rpc('current_kitchen_id')
    if (error) throw error
    const kid = (data as string) ?? null
    setKitchenId(kid)
    return kid
  }

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ingredients')
      .select('id,name,category,supplier,pack_size,pack_unit,pack_price,yield_percent,net_unit_cost,created_at')
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) throw error
    setItems((data ?? []) as Ingredient[])
  }

  useEffect(() => {
    ;(async () => {
      try {
        const kid = await loadKitchen()
        if (!kid) {
          setLoading(false)
          alert('No kitchen linked to this user yet.')
          return
        }
        await load()
      } catch (e: any) {
        setLoading(false)
        alert(e.message)
      }
    })()
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const i of items) if (i.category && i.category.trim()) set.add(i.category.trim())
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [items])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items.filter((i) => {
      const hay = [i.name, i.category ?? '', i.supplier ?? ''].join(' ').toLowerCase()
      const okQ = !s || hay.includes(s)
      const okCat = categoryFilter === 'all' || (i.category ?? '').trim() === categoryFilter
      return okQ && okCat
    })
  }, [items, q, categoryFilter])

  const stats = useMemo(() => {
    const count = filtered.length
    const avgNet = count ? filtered.reduce((acc, i) => acc + (i.net_unit_cost ?? 0), 0) / count : 0
    const avgYield = count ? filtered.reduce((acc, i) => acc + (i.yield_percent ?? 0), 0) / count : 0
    const maxPack = count ? Math.max(...filtered.map((i) => i.pack_price ?? 0)) : 0
    return { count, avgNet, avgYield, maxPack }
  }, [filtered])

  const onSave = async () => {
    if (!kitchenId) return alert('Kitchen not loaded yet')
    if (!name.trim()) return alert('Name is required')

    const payload = {
      kitchen_id: kitchenId,
      name: name.trim(),
      category: category.trim() || null,
      supplier: supplier.trim() || null,
      pack_size: toNum(packSize, 1),
      pack_unit: packUnit.trim() || 'unit',
      pack_price: toNum(packPrice, 0),
      yield_percent: toNum(yieldPercent, 100),
    }

    try {
      if (editing) {
        const { error } = await supabase.from('ingredients').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('ingredients').insert(payload)
        if (error) throw error
      }
      setOpen(false)
      await load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const onDelete = async (i: Ingredient) => {
    if (!confirm(`Delete ingredient: ${i.name}?`)) return
    const { error } = await supabase.from('ingredients').delete().eq('id', i.id)
    if (error) return alert(error.message)
    await load()
  }

  const yieldVal = toNum(yieldPercent, 100)
  const packPriceVal = toNum(packPrice, 0)
  const packSizeVal = toNum(packSize, 1)
  const previewNetUnit = packSizeVal > 0 && yieldVal > 0 ? packPriceVal / (packSizeVal * (yieldVal / 100)) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gc-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="gc-label">INGREDIENTS</div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight">Database</div>
            <div className="mt-2 text-sm text-neutral-600">
              Manage your ingredients with clean costing inputs. Net unit cost is computed server-side.
            </div>
            <div className="mt-3 text-xs text-neutral-500">Kitchen ID: {kitchenId ?? '—'}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              className="gc-input w-64"
              placeholder="Search ingredients…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="gc-input w-56"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button className="gc-btn gc-btn-primary" onClick={openCreate} type="button">
              + Add ingredient
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="gc-card p-5">
          <div className="gc-label">ITEMS</div>
          <div className="mt-2 text-2xl font-extrabold">{stats.count}</div>
          <div className="mt-1 text-xs text-neutral-500">Filtered results</div>
        </div>
        <div className="gc-card p-5">
          <div className="gc-label">AVG NET UNIT</div>
          <div className="mt-2 text-2xl font-extrabold">{money(stats.avgNet)}</div>
          <div className="mt-1 text-xs text-neutral-500">Average net unit cost</div>
        </div>
        <div className="gc-card p-5">
          <div className="gc-label">AVG YIELD</div>
          <div className="mt-2 text-2xl font-extrabold">{stats.avgYield.toFixed(1)}%</div>
          <div className="mt-1 text-xs text-neutral-500">Average yield</div>
        </div>
        <div className="gc-card p-5">
          <div className="gc-label">MAX PACK PRICE</div>
          <div className="mt-2 text-2xl font-extrabold">{money(stats.maxPack)}</div>
          <div className="mt-1 text-xs text-neutral-500">Highest pack price</div>
        </div>
      </div>

      {/* Table */}
      <div className="gc-card p-6">
        {loading ? (
          <div className="text-sm text-neutral-600">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-neutral-600">
            No ingredients found. Try clearing filters or add a new ingredient.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold text-neutral-500">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Supplier</th>
                  <th className="py-2 pr-4">Pack</th>
                  <th className="py-2 pr-4">Pack Price</th>
                  <th className="py-2 pr-4">Yield %</th>
                  <th className="py-2 pr-4">Net Unit Cost</th>
                  <th className="py-2 pr-0 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {filtered.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="py-3 pr-4">
                      <div className="font-semibold">{i.name}</div>
                      <div className="text-xs text-neutral-500">ID: {i.id.slice(0, 8)}…</div>
                    </td>
                    <td className="py-3 pr-4">{i.category ?? '—'}</td>
                    <td className="py-3 pr-4">{i.supplier ?? '—'}</td>
                    <td className="py-3 pr-4">
                      {i.pack_size} {i.pack_unit}
                    </td>
                    <td className="py-3 pr-4">{money(i.pack_price)}</td>
                    <td className="py-3 pr-4">{(i.yield_percent ?? 0).toFixed(1)}%</td>
                    <td className="py-3 pr-4 font-semibold">{money(i.net_unit_cost)}</td>
                    <td className="py-3 pr-0 text-right">
                      <div className="inline-flex gap-2">
                        <button className="gc-btn gc-btn-ghost" onClick={() => openEdit(i)} type="button">
                          Edit
                        </button>
                        <button className="gc-btn gc-btn-ghost" onClick={() => onDelete(i)} type="button">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="gc-card w-full max-w-3xl p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="gc-label">{editing ? 'EDIT' : 'CREATE'}</div>
                <div className="mt-1 text-xl font-extrabold">{editing ? 'Edit ingredient' : 'Add ingredient'}</div>
              </div>
              <button className="gc-btn gc-btn-ghost" onClick={() => setOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="gc-label">NAME</div>
                <input className="gc-input mt-2" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <div className="gc-label">CATEGORY</div>
                <input className="gc-input mt-2" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>

              <div>
                <div className="gc-label">SUPPLIER</div>
                <input className="gc-input mt-2" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              </div>

              <div>
                <div className="gc-label">PACK UNIT</div>
                <input className="gc-input mt-2" value={packUnit} onChange={(e) => setPackUnit(e.target.value)} />
              </div>

              <div>
                <div className="gc-label">PACK SIZE</div>
                <input
                  className="gc-input mt-2"
                  value={packSize}
                  onChange={(e) => setPackSize(e.target.value)}
                  type="number"
                  step="0.01"
                />
              </div>

              <div>
                <div className="gc-label">PACK PRICE</div>
                <input
                  className="gc-input mt-2"
                  value={packPrice}
                  onChange={(e) => setPackPrice(e.target.value)}
                  type="number"
                  step="0.01"
                />
              </div>

              <div>
                <div className="gc-label">YIELD %</div>
                <input
                  className="gc-input mt-2"
                  value={yieldPercent}
                  onChange={(e) => setYieldPercent(e.target.value)}
                  type="number"
                  step="0.01"
                />
              </div>

              <div className="gc-card p-4">
                <div className="gc-label">PREVIEW</div>
                <div className="mt-2 text-sm text-neutral-600">
                  Estimated net unit (client preview):
                  <div className="mt-1 text-lg font-extrabold">{money(previewNetUnit)}</div>
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  Final net unit cost comes from database (net_unit_cost).
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="gc-btn gc-btn-ghost" onClick={() => setOpen(false)} type="button">
                Cancel
              </button>
              <button className="gc-btn gc-btn-primary" onClick={onSave} type="button">
                {editing ? 'Save changes' : 'Create ingredient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
