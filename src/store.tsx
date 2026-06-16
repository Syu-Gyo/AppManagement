import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Member } from './data/types'
import { SEED_MEMBERS, SOFTWARE_LIST } from './data/seed'

const STORAGE_KEY = 'appmgmt.members.v1'

interface Store {
  members: Member[]
  software: string[]
  addMember: (m: Omit<Member, 'id'>) => void
  updateMember: (id: number, patch: Partial<Member>) => void
  removeMember: (id: number) => void
  toggleLicense: (id: number, sw: string) => void
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

function load(): Member[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Member[]
  } catch {
    /* ignore */
  }
  return SEED_MEMBERS
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(members))
    } catch {
      /* ignore */
    }
  }, [members])

  const store = useMemo<Store>(
    () => ({
      members,
      software: [...SOFTWARE_LIST],
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
      resetDemo: () => setMembers(SEED_MEMBERS),
    }),
    [members],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used within StoreProvider')
  return s
}
