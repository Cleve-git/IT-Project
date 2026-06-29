import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Profile } from '../types';

interface AuthState {
  user: Profile | null;
  token: string | null;
  isAuthenticated: boolean;
  setSession: (user: Profile, token: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setSession: (user, token) => set({ user, token, isAuthenticated: true }),
      clearSession: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'cda-auth-store', // persisted inside localStorage
    }
  )
);
