import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type IngredientRow = {
  id: string
  kitchen_id?: string
  name: string
  category: string | null
  supplier: string | null
  pack: number | null
  pack_unit: string | null
  pack_price: number | null
  yield_pct: number | null
  net_unit_cost: number | null
  is_active: boolean
}

function toNum(x: any, fallback = 0) {
  const n = Number(x)
  return Number.isFinite(n) ? n : fallback
}

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v)
}

export default function Ingredients() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [rows, setRows] = useState<IngredientRow[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      let q = supabase
        .from('ingredients')
        .select('id,kitchen_id,name,category,supplier,pack,pack_unit,pack_price,yield_pct,net_unit_cost,is_active')
        .order('name', { ascending: true })

      // show only active by default
      if (!showInactive) q = q.eq('is_active', true)

      const { data, error } = await q
      if (error) throw error
      setRows((data ?? []) as IngredientRow[])
      setLoading(false)
    } catch (e: any) {
      setErr(e?.message ?? 'Unknown error')
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive])

  const categories = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) {
      if (r.category && r.category.trim()) s.add(r.category.trim())
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return rows.filter((r) => {
      const okSearch =
        !s ||
        r.name.toLowerCase().includes(s) ||
        (r.supplier ?? '').toLowerCase().includes(s)

      const okCat = !category || (r.category ?? '') === category
      return okSearch && okCat
    })
  }, [rows, search, category])

  const stats = useMemo(() => {
    const list = filtered
    const items = list.length
    const avgNet =
      items > 0 ? list.reduce((a, r) => a + toNum(r.net_unit_cost, 0), 0) / items : 0
    const avgYield =
      items > 0 ? list.reduce((a, r) => a + toNum(r.yield_pct, 100), 0) / items : 100
    const maxPackPrice =
      items > 0 ? Math.max(...list.map((r) => toNum(r.pack_price, 0))) : 0
    return { items, avgNet, avgYield, maxPackPrice }
  }, [filtered])

  // ✅ Soft delete (Deactivate) بدل Delete الحقيقي
  const deactivate = async (id: string) => {
    if (!confirm('Deactivate this ingredient? (It will be hidden from pickers)')) return
    const { error } = await supabase.from('ingredients').update({ is_active: false }).eq('id', id)
    if (error) return alert(error.message)
    await load()
  }

  const restore = async (id: string) => {
    const { error } = await supabase.from('ingredients').update({ is_active: true }).eq('id', id)
    if (error) return alert(error.message)
    await load()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gc-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="gc-label">INGREDIENTS</div>
            <div className="mt-2 text-2xl font-extrabold">Database</div>
            <div className="mt-2 text-sm text-neutral-600">
              Manage ingredients, costs, and availability.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>

            {/* هذا الزر موجود عندك أصلاً في مشروعك (Add ingredient) — نتركه UI فقط */}
            <button className="gc-btn gc-btn-primary" type="button">
              + Add ingredient
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <div className="gc-label">SEARCH</div>
            <input
              className="gc-input mt-2 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or supplier…"
            />
          </div>

          <div className="min-w-[240px]">
            <div className="gc-label">CATEGORY</div>
            <select
              className="gc-input mt-2 w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="gc-card p-6">
          <div className="text-sm text-neutral-600">Loading…</div>
        </div>
      )}
      {err && (
        <div className="gc-card p-6">
          <div className="gc-label">ERROR</div>
          <div className="mt-2 text-sm text-red-600">{err}</div>
        </div>
      )}

      {!loading && !err && (
        <>
          {/* Stats cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="gc-card p-5">
              <div className="gc-label">ITEMS</div>
              <div className="mt-2 text-2xl font-extrabold">{stats.items}</div>
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
              <div className="mt-2 text-2xl font-extrabold">{money(stats.maxPackPrice)}</div>
              <div className="mt-1 text-xs text-neutral-500">Highest pack price</div>
            </div>
          </div>

          {/* Table */}
          <div className="gc-card p-6">
            <div className="gc-label">LIST</div>

            {filtered.length === 0 ? (
              <div className="mt-3 text-sm text-neutral-600">No ingredients found.</div>
            ) : (
              <div className="mt-4 overflow-auto">
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
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-3 pr-4">
                          <div className="font-semibold">
                            {r.name}{' '}
                            {!r.is_active && (
                              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-500">ID: {r.id}</div>
                        </td>

                        <td className="py-3 pr-4">{r.category ?? '—'}</td>
                        <td className="py-3 pr-4">{r.supplier ?? '—'}</td>

                        <td className="py-3 pr-4">
                          {r.pack ?? '—'} {r.pack_unit ?? ''}
                        </td>

                        <td className="py-3 pr-4">{money(toNum(r.pack_price, 0))}</td>
                        <td className="py-3 pr-4">{toNum(r.yield_pct, 100).toFixed(1)}%</td>
                        <td className="py-3 pr-4 font-semibold">{money(toNum(r.net_unit_cost, 0))}</td>

                        <td className="py-3 pr-0 text-right">
                          {/* نترك Edit موجود لواجهتك الحالية */}
                          <button className="gc-btn gc-btn-ghost" type="button">
                            Edit
                          </button>

                          {r.is_active ? (
                            <button
                              className="gc-btn gc-btn-ghost"
                              onClick={() => deactivate(r.id)}
                              type="button"
                            >
                              Delete
                            </button>
                          ) : (
                            <button
                              className="gc-btn gc-btn-ghost"
                              onClick={() => restore(r.id)}
                              type="button"
                            >
                              Restore
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-3 text-xs text-neutral-500">
                  * “Delete” هنا = Deactivate (Soft Delete) لحماية الوصفات ومنع أخطاء FK.
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
