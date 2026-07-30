import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  session: unknown | null;

  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setSession: (session: unknown | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  session: null,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setSession: (session) => set({ session }),
  clear: () => set({ user: null, session: null, loading: false }),
}));
