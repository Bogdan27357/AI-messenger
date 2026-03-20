import { create } from "zustand";

interface SyncEntry {
  id: string;
  template_slug: string;
  category: string;
  department: string;
  status: string;
  message: string;
  created_at: string;
}

interface OneCStatus {
  connected: boolean;
  counterparties: number;
  flights: number;
  employees: number;
  documents: number;
}

interface SyncState {
  syncLog: SyncEntry[];
  onecStatus: OneCStatus;
  addSyncEntry: (entry: SyncEntry) => void;
  setSyncLog: (log: SyncEntry[]) => void;
  setOneCStatus: (status: OneCStatus) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  syncLog: [],
  onecStatus: {
    connected: false,
    counterparties: 0,
    flights: 0,
    employees: 0,
    documents: 0,
  },
  addSyncEntry: (entry) =>
    set((state) => ({
      syncLog: [entry, ...state.syncLog].slice(0, 100),
    })),
  setSyncLog: (log) => set({ syncLog: log.slice(0, 100) }),
  setOneCStatus: (status) => set({ onecStatus: status }),
}));
