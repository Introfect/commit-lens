import { createContext, useContext, type ReactNode } from "react";
import type { User } from "~/types";

type AuthContextType = {
  user: User | null;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

type AuthProviderProps = {
  user: User | null;
  children: ReactNode;
};

export function AuthProvider({ user, children }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
}