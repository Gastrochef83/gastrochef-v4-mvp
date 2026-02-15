import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Toast } from '../components/Toast'

type RecipeRow = {
  id: string
  kitchen_id: string
  name: string
  category: string | null
  portions: number
  is_subrecipe: boolean
  is_archived: boolean
  photo_url: string | null
  description: string | null
  calories: number | null
  created_at?: string | null
}

function toNum(x: any, fallback = 0) {
  const n = Number(x)
  return Number.isFinite(n) ? n : fallback
}

function clampStr(s: string, max = 110) {
  const x = (s ?? '').trim()
  if (!x) return ''
  if (x.length <= max) return x
  return x.slice(0, max - 1) + '…'
}

function upperChip(x: string) {
  return (x || '').trim().toUpperCase()
}

export default function Recipes() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<RecipeRow[]>([])
  const [q, setQ] = useState('')

  const [toastMsg, setToastMsg] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastOpen(true)
  }

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(
          'id,kitchen_id,name,category,portions,is_subrecipe,is_archived,photo_url,description,calories,created_at'
        )
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRows((data ?? []) as RecipeRow[])
    } catch (e: any) {
      showToast(e?.message ?? 'Load failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => {
      const a = (r.name ?? '').toLowerCase()
      const b = (r.category ?? '').toLowerCase()
      return a.includes(s) || b.includes(s)
    })
  }, [rows, q])

  const createNew = async () => {
    try {
      const kitchenId = rows[0]?.kitchen_id ?? 'default'
      const { data, error } = await supabase
        .from('recipes')
        .insert({
          kitchen_id: kitchenId,
          name: 'New Recipe',
          category: null,
          portions: 1,
          is_subrecipe: false,
          is_archived: false,
        })
        .select('id')
        .single()

      if (error) throw error
      const newId = (data as any)?.id
      showToast('Created ✅')
      if (newId) window.location.hash = `#/recipe?id=${newId}`
      else await load()
    } catch (e: any) {
      showToast(e?.message ?? 'Create failed')
    }
  }

  const archive = async (id: string) => {
    try {
      const { error } = await supabase.from('recipes').update({ is_archived: true }).eq('id', id)
      if (error) throw error
      showToast('Archived ✅')
      await load()
    } catch (e: any) {
      showToast(e?.message ?? 'Archive failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gc-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="gc-label">RECIPES</div>
            <div className="mt-2 text-2xl font-extrabold">Recipe Library</div>
            <div className="mt-1 text-sm text-neutral-600">
              Grid Ultimate++ (background-image hero, zero distortion).
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              className="gc-input w-[min(360px,80vw)]"
              placeholder="Search by name or category..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="gc-btn gc-btn-ghost" onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button className="gc-btn gc-btn-primary" onClick={createNew}>
              + New
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="gc-card p-6">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="gc-card p-6">
          <div className="text-sm text-neutral-600">No recipes. Create your first one.</div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((r) => {
            const cat = upperChip(r.category || 'Uncategorized')
            const portions = toNum(r.portions, 1)
            const kcal = r.calories != null ? toNum(r.calories, 0) : null

            const heroStyle: React.CSSProperties = r.photo_url
              ? {
                  backgroundImage: `url("${r.photo_url}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.00), rgba(0,0,0,0.25)), linear-gradient(180deg, #f3f4f6, #e5e7eb)',
                }

            return (
              <div key={r.id} className="gc-menu-card gc-card-ultimate">
                {/* HERO (ratio lock via padding, and BACKGROUND image = no <img> distortion possible) */}
                <div className="gc-hero-ratio" style={heroStyle}>
                  <div className="gc-hero-overlay" />

                  <div className="gc-hero-badges">
                    <span className="gc-chip gc-chip-dark">{cat}</span>
                    {kcal != null ? <span className="gc-chip">{kcal} kcal</span> : null}
                    {r.is_subrecipe ? <span className="gc-chip">SUB</span> : null}
                  </div>

                  {/* Quick actions (appears on hover) */}
                  <div className="gc-hero-actions">
                    <NavLink className="gc-mini-btn gc-mini-primary" to={`/recipe?id=${r.id}`}>
                      Open
                    </NavLink>
                    <NavLink className="gc-mini-btn" to={`/cook?id=${r.id}`}>
                      Cook
                    </NavLink>
                  </div>

                  {!r.photo_url && <div className="gc-hero-nophoto">No Photo</div>}
                </div>

                {/* BODY (fixed height to align) */}
                <div className="gc-card-body">
                  <div>
                    <div className="gc-title">{r.name}</div>
                    <div className="gc-sub">Portions: {portions}</div>

                    <div className="gc-desc">
                      {r.description?.trim() ? clampStr(r.description, 110) : 'Add description…'}
                    </div>
                  </div>

                  <div className="gc-actions-row">
                    <NavLink className="gc-btn gc-btn-primary" to={`/recipe?id=${r.id}`}>
                      Open Editor
                    </NavLink>

                    <NavLink className="gc-btn gc-btn-ghost" to={`/cook?id=${r.id}`}>
                      Cook
                    </NavLink>

                    <button className="gc-btn gc-btn-ghost" onClick={() => archive(r.id)} type="button">
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Toast open={toastOpen} message={toastMsg} onClose={() => setToastOpen(false)} />
    </div>
  )
}
