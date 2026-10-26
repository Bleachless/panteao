"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// O "login" do Panteão: um token por sala guardado no aparelho. Fechou a aba? Volta pelo mesmo link.

interface Session {
  name: string;
  sigil: number;
  seats: Record<string, { token: string; you: string; at: number }>;
  setProfile: (name: string, sigil: number) => void;
  remember: (code: string, token: string, you: string) => void;
  forget: (code: string) => void;
}

export const useSession = create<Session>()(
  persist(
    (set) => ({
      name: "",
      sigil: 0,
      seats: {},
      setProfile: (name, sigil) => set({ name, sigil }),
      remember: (code, token, you) =>
        set((s) => {
          // Guarda só as 20 salas mais recentes.
          const seats = Object.fromEntries(
            Object.entries({ ...s.seats, [code]: { token, you, at: Date.now() } })
              .sort((a, b) => b[1].at - a[1].at)
              .slice(0, 20),
          );
          return { seats };
        }),
      forget: (code) =>
        set((s) => {
          const seats = { ...s.seats };
          delete seats[code];
          return { seats };
        }),
    }),
    { name: "panteao-sessao", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

export function tokenFor(code: string): string | null {
  return useSession.getState().seats[code]?.token ?? null;
}
