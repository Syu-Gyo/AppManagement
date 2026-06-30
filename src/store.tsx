import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Member } from './data/types'
import { SEED_MEMBERS, SOFTWARE_LIST } from './data/seed'
import type { SoftwareMeta } from './data/types'
import { registerCustomMeta, metaOf } from './data/software'
import type { Contract } from './data/contracts'
import { SEED_CONTRACTS } from './data/contracts'
import type { ApiKey } from './data/apikeys'
import { SEED_APIKEYS } from './data/apikeys'
import type { Budget, BudgetCategory } from './data/budgets'
import { SEED_BUDGETS } from './data/budgets'
import type { UsageRecord, SurveyRound } from './data/usage'
import { pushUsage, fetchUsage } from './lib/syncUsage'
import type { ApplicationGroup } from './data/application'
import { INITIAL_GROUPS } from './data/application'
import { supabase } from './lib/supabase'

const STORAGE_KEY = 'appmgmt.members.v1'
const CONTRACTS_KEY = 'appmgmt.contracts.v1'
const APIKEYS_KEY = 'appmgmt.apikeys.v1'
const BUDGETS_KEY = 'appmgmt.budgets.v1'
const USAGE_KEY = 'appmgmt.usage.v3'
const SURVEYS_KEY = 'appmgmt.surveys.v2'
const ARCHIVED_SW_KEY = 'appmgmt.archivedSoftware.v1'
const APPLICATIONS_KEY = 'appmgmt.applications.v1'
const CUSTOM_SW_KEY = 'appmgmt.customSoftware.v1'
const CUSTOM_META_KEY = 'appmgmt.customMeta.v1'


interface Store {
  members: Member[]
  software: string[]
  archivedSoftware: string[]
  contracts: Contract[]
  apiKeys: ApiKey[]
  budgets: Budget[]
  usage: UsageRecord[]
  surveyRounds: SurveyRound[]
  addMember: (m: Omit<Member, 'id'>) => void
  updateMember: (id: number, patch: Partial<Member>) => void
  removeMember: (id: number) => void
  toggleLicense: (id: number, sw: string) => void
  importMembersFromSheet: (rows: Array<Pick<Member, 'name' | 'department' | 'section'>>) => void
  addContract: (c: Omit<Contract, 'id'>) => void
  updateContract: (id: number, patch: Partial<Contract>) => void
  removeContract: (id: number) => void
  addApiKey: (k: Omit<ApiKey, 'id'>) => void
  updateApiKey: (id: number, patch: Partial<ApiKey>) => void
  removeApiKey: (id: number) => void
  setBudget: (year: number, category: BudgetCategory, amount: number) => void
  /** 繧｢繝ｳ繧ｱ繝ｼ繝育ｵ先棡繧貞叙繧願ｾｼ縺ｿ縲・memberId, software) 蜊倅ｽ阪〒譛譁ｰ蝗樒ｭ斐↓荳頑嶌縺・*/
  importUsage: (records: UsageRecord[], round?: Omit<SurveyRound, 'id'>) => void
  applicationGroups: ApplicationGroup[]
  setApplicationGroups: (groups: ApplicationGroup[]) => void
  saveApplicationGroups: (groups: ApplicationGroup[]) => Promise<void>
  initFromSupabase: () => Promise<void>
  archiveSoftware: (sw: string) => void
  unarchiveSoftware: (sw: string) => void
  customSoftware: string[]
  customMeta: Record<string, SoftwareMeta>
  addSoftwareTool: (key: string, meta: Omit<SoftwareMeta, 'name'>) => void
  updateSoftwareMeta: (key: string, patch: Partial<SoftwareMeta>) => void
  removeSoftwareTool: (key: string) => void
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* ignore */
  }
  return fallback
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(() => load(STORAGE_KEY, SEED_MEMBERS))
  const [contracts, setContracts] = useState<Contract[]>(() => load(CONTRACTS_KEY, SEED_CONTRACTS))
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => load(APIKEYS_KEY, SEED_APIKEYS))
  const [budgets, setBudgets] = useState<Budget[]>(() => load(BUDGETS_KEY, SEED_BUDGETS))
  const [usage, setUsage] = useState<UsageRecord[]>(() => load(USAGE_KEY, []))
  const [surveyRounds, setSurveyRounds] = useState<SurveyRound[]>(() => load(SURVEYS_KEY, []))
  const [archivedSoftware, setArchivedSoftware] = useState<string[]>(() => load(ARCHIVED_SW_KEY, []))
  const [customSoftware, setCustomSoftware] = useState<string[]>(() => load(CUSTOM_SW_KEY, []))
  const [customMeta, setCustomMeta] = useState<Record<string, SoftwareMeta>>(() => {
    const m = load(CUSTOM_META_KEY, {} as Record<string, SoftwareMeta>)
    registerCustomMeta(m)
    return m
  })
  const [applicationGroups, setApplicationGroups] = useState<ApplicationGroup[]>(
    () => load(APPLICATIONS_KEY, INITIAL_GROUPS)
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(members))
    } catch {
      /* ignore */
    }
  }, [members])

  useEffect(() => {
    try {
      localStorage.setItem(CONTRACTS_KEY, JSON.stringify(contracts))
    } catch {
      /* ignore */
    }
  }, [contracts])

  useEffect(() => {
    try {
      localStorage.setItem(APIKEYS_KEY, JSON.stringify(apiKeys))
    } catch {
      /* ignore */
    }
  }, [apiKeys])

  useEffect(() => {
    try {
      localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets))
    } catch {
      /* ignore */
    }
  }, [budgets])

  useEffect(() => {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(usage))
    } catch {
      /* ignore */
    }
  }, [usage])

  useEffect(() => {
    try {
      localStorage.setItem(SURVEYS_KEY, JSON.stringify(surveyRounds))
    } catch {
      /* ignore */
    }
  }, [surveyRounds])

  useEffect(() => {
    try {
      localStorage.setItem(ARCHIVED_SW_KEY, JSON.stringify(archivedSoftware))
    } catch { /* ignore */ }
  }, [archivedSoftware])

  useEffect(() => {
    try { localStorage.setItem(CUSTOM_SW_KEY, JSON.stringify(customSoftware)) } catch { /* ignore */ }
  }, [customSoftware])

  useEffect(() => {
    registerCustomMeta(customMeta)
    try { localStorage.setItem(CUSTOM_META_KEY, JSON.stringify(customMeta)) } catch { /* ignore */ }
  }, [customMeta])

  useEffect(() => {
    try { localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applicationGroups)) } catch { /* ignore */ }
  }, [applicationGroups])

  const store = useMemo<Store>(
    () => ({
      members,
      software: [...SOFTWARE_LIST, ...customSoftware],
      archivedSoftware,
      customSoftware,
      customMeta,
      addSoftwareTool: (key, meta) => {
        const fullMeta: SoftwareMeta = { name: key, ...meta }
        setCustomSoftware((prev) => prev.includes(key) ? prev : [...prev, key])
        setCustomMeta((prev) => ({ ...prev, [key]: fullMeta }))
      },
      updateSoftwareMeta: (key, patch) => {
        setCustomMeta((prev) => {
          // 組み込みツールも編集できるよう、既存の有効なメタ（静的 or カスタム）をベースにする
          const base = prev[key] ?? metaOf(key)
          return { ...prev, [key]: { ...base, ...patch } }
        })
      },
      removeSoftwareTool: (key) => {
        setCustomSoftware((prev) => prev.filter((s) => s !== key))
        setCustomMeta((prev) => { const next = { ...prev }; delete next[key]; return next })
      },
      addMember: (m) =>
        setMembers((prev) => [...prev, { ...m, id: Math.max(0, ...prev.map((p) => p.id)) + 1 }]),
      updateMember: (id, patch) =>
        setMembers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      removeMember: (id) => setMembers((prev) => prev.filter((p) => p.id !== id)),
      toggleLicense: (id, sw) =>
        setMembers((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  licenses: p.licenses.includes(sw)
                    ? p.licenses.filter((s) => s !== sw)
                    : [...p.licenses, sw],
                }
              : p,
          ),
        ),
      importMembersFromSheet: (rows) =>
        setMembers((prev) => {
          const normalize = (s: string) => s.trim().replace(/\s+/g, '')
          const byName = new Map(prev.map((m) => [normalize(m.name), m]))
          const used = new Set<number>()
          let nextId = Math.max(0, ...prev.map((m) => m.id)) + 1
          const imported = rows.map((r) => {
            const existing = byName.get(normalize(r.name))
            if (existing) {
              used.add(existing.id)
              return { ...existing, name: r.name, department: r.department, section: r.section }
            }
            return { id: nextId++, name: r.name, department: r.department, section: r.section, email: '', licenses: [] }
          })
          return [...imported, ...prev.filter((m) => !used.has(m.id))]
        }),
      contracts,
      addContract: (c) =>
        setContracts((prev) => [...prev, { ...c, id: Math.max(0, ...prev.map((p) => p.id)) + 1 }]),
      updateContract: (id, patch) =>
        setContracts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      removeContract: (id) => setContracts((prev) => prev.filter((p) => p.id !== id)),
      apiKeys,
      addApiKey: (k) =>
        setApiKeys((prev) => [...prev, { ...k, id: Math.max(0, ...prev.map((p) => p.id)) + 1 }]),
      updateApiKey: (id, patch) =>
        setApiKeys((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      removeApiKey: (id) => setApiKeys((prev) => prev.filter((p) => p.id !== id)),
      budgets,
      setBudget: (year, category, amount) =>
        setBudgets((prev) => {
          const i = prev.findIndex((b) => b.year === year && b.category === category)
          if (i === -1) return [...prev, { year, category, amount }]
          const next = [...prev]
          next[i] = { ...next[i], amount }
          return next
        }),
      usage,
      surveyRounds,
      archiveSoftware: (sw) => setArchivedSoftware((prev) => prev.includes(sw) ? prev : [...prev, sw]),
      unarchiveSoftware: (sw) => setArchivedSoftware((prev) => prev.filter((s) => s !== sw)),
      importUsage: (records, round) => {
        const roundId = round ? `r${surveyRounds.length + 1}` : undefined
        if (round && roundId) setSurveyRounds((rs) => [...rs, { ...round, id: roundId }])
        setUsage((prev) => {
          const map = new Map(prev.map((u) => [`${u.memberId}::${u.software}`, u]))
          for (const r of records) map.set(`${r.memberId}::${r.software}`, r)
          return [...map.values()]
        })
        pushUsage(records, round, roundId).catch(console.error)
      },
      applicationGroups,
      setApplicationGroups,
      saveApplicationGroups: async (groups: ApplicationGroup[]) => {
        setApplicationGroups(groups)
        if (!supabase) return
        try {
          await supabase.from('application_groups').upsert(
            groups.map(g => ({ id: g.id, software: g.software, submissions: g.submissions })),
            { onConflict: 'id' }
          )
          const { data: existing } = await supabase.from('application_groups').select('id')
          if (existing) {
            const currentIds = new Set(groups.map(g => g.id))
            const toDelete = existing.filter((r: { id: string }) => !currentIds.has(r.id)).map((r: { id: string }) => r.id)
            if (toDelete.length > 0) {
              await supabase.from('application_groups').delete().in('id', toDelete)
            }
          }
        } catch { /* ignore - table may not exist */ }
      },
      initFromSupabase: async () => {
        const { records, rounds } = await fetchUsage()
        if (records.length === 0 && rounds.length === 0) return
        setUsage((prev) => {
          const map = new Map(prev.map((u) => [`${u.memberId}::${u.software}`, u]))
          for (const r of records) {
            const key = `${r.memberId}::${r.software}`
            const existing = map.get(key)
            if (!existing || r.surveyedAt >= existing.surveyedAt) map.set(key, r)
          }
          return [...map.values()]
        })
        setSurveyRounds((prev) => {
          const ids = new Set(prev.map((r) => r.id))
          const fresh = rounds.filter((r) => !ids.has(r.id))
          return fresh.length > 0 ? [...prev, ...fresh] : prev
        })
        if (supabase) {
          try {
            const { data } = await supabase.from('application_groups').select('*')
            if (data && data.length > 0) {
              setApplicationGroups(data.map((r: { id: string; software: string; submissions: ApplicationGroup['submissions'] }) => ({
                id: r.id,
                software: r.software,
                submissions: r.submissions,
              })))
            }
          } catch { /* ignore - table may not exist */ }
        }
      },
      resetDemo: () => {
        setMembers(SEED_MEMBERS)
        setContracts(SEED_CONTRACTS)
        setApiKeys(SEED_APIKEYS)
        setBudgets(SEED_BUDGETS)
        setUsage([])
        setSurveyRounds([])
        setArchivedSoftware([])
        setCustomSoftware([])
        setCustomMeta({})
        setApplicationGroups(INITIAL_GROUPS)
      },
    }),
    [members, contracts, apiKeys, budgets, usage, surveyRounds, archivedSoftware, customSoftware, customMeta, applicationGroups],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used within StoreProvider')
  return s
}
