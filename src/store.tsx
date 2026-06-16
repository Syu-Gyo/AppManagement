import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Member } from './data/types'
import { SEED_MEMBERS, SOFTWARE_LIST } from './data/seed'
import type { Contract } from './data/contracts'
import { SEED_CONTRACTS } from './data/contracts'
import type { ApiKey } from './data/apikeys'
import { SEED_APIKEYS } from './data/apikeys'

const STORAGE_KEY = 'appmgmt.members.v1'
const CONTRACTS_KEY = 'appmgmt.contracts.v1'
const APIKEYS_KEY = 'appmgmt.apikeys.v1'

interface Store {
  members: Member[]
  software: string[]
  contracts: Contract[]
  apiKeys: ApiKey[]
  addMember: (m: Omit<Member, 'id'>) => void
  updateMember: (id: number, patch: Partial<Member>) => void
  removeMember: (id: number) => void
  toggleLicense: (id: number, sw: string) => void
  addContract: (c: Omit<Contract, 'id'>) => void
  updateContract: (id: number, patch: Partial<Contract>) => void
  removeContract: (id: number) => void
  addApiKey: (k: Omit<ApiKey, 'id'>) => void
  updateApiKey: (id: number, patch: Partial<ApiKey>) => void
  removeApiKey: (id: number) => void
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
      resetDemo: () => {
        setMembers(SEED_MEMBERS)
        setContracts(SEED_CONTRACTS)
        setApiKeys(SEED_APIKEYS)
      },
    }),
    [members, contracts, apiKeys],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used within StoreProvider')
  return s
}
