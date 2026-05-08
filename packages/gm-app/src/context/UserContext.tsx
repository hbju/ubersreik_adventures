import React, { createContext, useContext } from 'react';
import type { User } from '@wfrp/shared';
import { useUsers } from '../hooks/useUsers';

interface UserContextValue {
  users: User[];
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  createUser: (username: string, password: string) => Promise<User | null>;
  deleteUser: (userId: string) => Promise<boolean>;
  setUserCharacter: (userId: string, characterId: string | null) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used within UserProvider');
  return ctx;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const value = useUsers();
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
