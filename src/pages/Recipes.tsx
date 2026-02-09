import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type RecipeRow = {
  id: string
  name: string
  category: string | null
  portions: number
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  created_at?: string | null
}

export default function Recipes() {
  const [items, setItems] = useState<RecipeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('recipes')
      .select('id,name,category,portions,calories,protein_g,carbs_g,fat_g,created_at')
      .order('created_at', { ascending: false })

    setLoading(false)
    if (error) {
      alert(error.message)
      return
    }
    setItems((data ?? []) as RecipeRow[])
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items
    return items.filter((r) =>
      [r.name, r.category ?? ''].join(' ').toLowerCase().includes(s)
    )
  }, [items, q])

  const openEditor = (id: string) => {
    window.location.hash = `#/recipe-editor?id=${id}`
  }

  const onDelete = async (r: RecipeRow) => {
    if (!confirm(`Delete recipe: ${r.name}?`)) return
    const { error } = await supabase.from('recipes').delete().eq('id', r.id)
    if (error) return alert(error.message)
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="gc-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="gc-label">RECIPES</div>
            <div className="mt-2 text-3xl font-extrabold">Recipes</div>
            <div className="mt-2 text-sm text-neutral-600">
              Open a recipe to add ingredient lines (qty/unit) and see costing.
            </div>
          </div>

          <input
            className="gc-input w-72"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="gc-card p-6">
        {loading ? (
          <div className="text-sm text-neutral-600">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-neutral-600">No recipes yet.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold text-neutral-500">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Portions</th>
                  <th className="py-2 pr-4">Calories</th>
                  <th className="py-2 pr-4">Protein</th>
                  <th className="py-2 pr-4">Carbs</th>
                  <th className="py-2 pr-4">Fat</th>
                  <th className="py-2 pr-0 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-3 pr-4 font-semibold">{r.name}</td>
                    <td className="py-3 pr-4">{r.category ?? '—'}</td>
                    <td className="py-3 pr-4">{r.portions}</td>
                    <td className="py-3 pr-4">{r.calories ?? '—'}</td>
                    <td className="py-3 pr-4">{r.protein_g ?? '—'}</td>
                    <td className="py-3 pr-4">{r.carbs_g ?? '—'}</td>
                    <td className="py-3 pr-4">{r.fat_g ?? '—'}</td>
                    <td className="py-3 pr-0 text-right">
                      <div className="inline-flex gap-2">
                        <button className="gc-btn gc-btn-primary" onClick={() => openEditor(r.id)} type="button">
                          Open Editor
                        </button>
                        <button className="gc-btn gc-btn-ghost" onClick={() => onDelete(r)} type="button">
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
    </div>
  )
}
