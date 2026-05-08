import { useCallback, useEffect, useState } from 'react';
import type { User } from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i += 1) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }
  return hash.toString(36);
}

type MemberRow = {
  user_id: string;
  role: string;
  profiles?: {
    display_name?: string | null;
    created_at?: string | null;
  } | null;
};

export function useUsers() {
  const { supabase, currentCampaignId } = useAppContext();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!currentCampaignId) return;
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('campaign_members')
      .select('user_id, role, profiles(display_name, created_at)')
      .eq('campaign_id', currentCampaignId);

    if (fetchError) {
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    const mapped = ((data ?? []) as MemberRow[])
      .filter((row) => row.role !== 'gm')
      .map((row) => ({
        id: row.user_id,
        username: row.profiles?.display_name ?? 'Unknown user',
        passwordHash: '',
        characterId: null,
        createdAt: row.profiles?.created_at ?? new Date().toISOString(),
      }));

    setUsers(mapped);
    setIsLoading(false);
  }, [currentCampaignId, supabase]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = useCallback(async (username: string, password: string) => {
    if (!currentCampaignId) return null;
    const syntheticEmail = `${username.replace(/\s+/g, '.').toLowerCase()}+${Date.now()}@players.local`;
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: syntheticEmail,
      password,
      options: {
        data: { display_name: username },
      },
    });

    if (signUpError || !signUpData.user) {
      setError(signUpError?.message ?? 'Unable to create player account');
      return null;
    }

    const { error: memberError } = await supabase
      .from('campaign_members')
      .insert({
        campaign_id: currentCampaignId,
        user_id: signUpData.user.id,
        role: 'player',
      });

    if (memberError) {
      setError(memberError.message);
      return null;
    }

    const newUser: User = {
      id: signUpData.user.id,
      username,
      passwordHash: hashPassword(password),
      characterId: null,
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [...prev, newUser]);
    setError(null);
    return newUser;
  }, [currentCampaignId, supabase]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!currentCampaignId) return false;
    const { error: deleteError } = await supabase
      .from('campaign_members')
      .delete()
      .eq('campaign_id', currentCampaignId)
      .eq('user_id', userId);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setError(null);
    return true;
  }, [currentCampaignId, supabase]);

  const setUserCharacter = useCallback((userId: string, characterId: string | null) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, characterId } : u)));
  }, []);

  return {
    users,
    isLoading,
    error,
    fetchUsers,
    createUser,
    deleteUser,
    setUserCharacter,
  };
}
