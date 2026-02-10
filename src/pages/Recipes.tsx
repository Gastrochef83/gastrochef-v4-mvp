import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type RecipeRow = {
  id: string
  name: string
  category: string | null
  portions: number
  kitchen_id: string
}

function slugNow() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Recipes() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [kitchenId, setKitchenId] = useState<string | null>(null)
  const [rows, setRows] = useState<RecipeRow[]>([])
  const [creating, setCreating] = useState(false)

  // Create form
  const [newName, setNewName] = useState('')
  const [newPortions, setNewPortions] = useState('1')
  const [newCategory, setNewCategory] = useState('')

  const loadKitchen = async () => {
    const { data, error } = await supabase.rpc('current_kitchen_id')
    if (error) throw error
    const kid = (data as string) ?? null
    setKitchenId(kid)
    return kid
  }

  const loadRecipes = async (kid: string) => {
    const { data, error } = await supabase
      .from('recipes')
      .select('id,name,category,portions,kitchen_id')
      .eq('kitchen_id', kid)
      .order('name', { ascending: true })

    if (error) throw error
    setRows((data ?? []) as RecipeRow[])
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const kid = await loadKitchen()
        if (!kid) {
          setErr('No kitchen linked to this user yet.')
          setLoading(false)
          return
        }
        await loadRecipes(kid)
        setLoading(false)

        // Default placeholder name
        setNewName(`New Recipe ${slugNow()}`)
      } catch (e: any) {
        setErr(e?.message ?? 'Unknown error')
        setLoading(false)
      }
    })()
  }, [])

  const count = useMemo(() => rows.length, [rows])

  const toNum = (s: string, fallback = 1) => {
    const n = Number(s)
    return Number.isFinite(n) ? n : fallback
  }

  const onCreateRecipe = async () => {
    if (!kitchenId) return alert('Missing kitchen id')
    // basic validation
    const name = (newName || '').trim()
    if (!name) return alert('Enter recipe name')

    const portions = Math.max(1, toNum(newPortions, 1))
    const category = (newCategory || '').trim() || null

    setCreating(true)
    try {
      const payload = {
        kitchen_id: kitchenId,
        name,
        category,
        portions,
      }

      const { data, error } = await supabase
        .from('recipes')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw error

      const newId = (data as any)?.id as string
      await loadRecipes(kitchenId)

      // Open editor directly
      window.location.hash = `#/recipe-editor?id=${newId}`
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create recipe')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="gc-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="gc-label">RECIPES</div>
            <div className="mt-2 text-2xl font-extrabold">Your Recipes</div>
            <div className="mt-2 text-sm text-neutral-600">Create, open, and manage recipes.</div>
            <div className="mt-3 text-xs text-neutral-500">
              Kitchen ID: {kitchenId ?? '—'} · Total: {count}
            </div>
          </div>
        </div>
      </div>

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
          {/* ✅ Create Recipe Card */}
          <div className="gc-card p-6">
            <div className="gc-label">CREATE RECIPE</div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <div className="gc-label">NAME</div>
                <input
                  className="gc-input mt-2 w-full"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Recipe name…"
                />
              </div>

              <div className="w-40">
                <div className="gc-label">PORTIONS</div>
                <input
                  className="gc-input mt-2"
                  type="number"
                  min={1}
                  step="1"
                  value={newPortions}
                  onChange={(e) => setNewPortions(e.target.value)}
                />
              </div>

              <div className="min-w-[220px]">
                <div className="gc-label">CATEGORY (optional)</div>
                <input
                  className="gc-input mt-2 w-full"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Main / Sauce / SR / Dessert"
                />
              </div>

              <div>
                <button
                  className="gc-btn gc-btn-primary"
                  onClick={onCreateRecipe}
                  type="button"
                  disabled={creating}
                >
                  {creating ? 'Creating…' : '+ Create recipe'}
                </button>
              </div>
            </div>
          </div>

          {/* ✅ Recipe List */}
          <div className="gc-card p-6">
            <div className="gc-label">LIST</div>

            {rows.length === 0 ? (
              <div className="mt-3 text-sm text-neutral-600">No recipes yet.</div>
            ) : (
              <div className="mt-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs font-semibold text-neutral-500">
                    <tr>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Portions</th>
                      <th className="py-2 pr-0 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-3 pr-4">
                          <div className="font-semibold">{r.name}</div>
                          <div className="text-xs text-neutral-500">{r.id}</div>
                        </td>
                        <td className="py-3 pr-4">{r.category ?? '—'}</td>
                        <td className="py-3 pr-4">{r.portions ?? 1}</td>
                        <td className="py-3 pr-0 text-right">
                          <a className="gc-btn gc-btn-ghost" href={`/#/recipe-editor?id=${r.id}`}>
                            Open editor
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
