import React, { createContext, useContext } from 'react';
import type { CharacterTemplate } from '@wfrp/shared';
import { useCharacterTemplates } from '../hooks/useCharacterTemplates';

interface CharacterTemplateContextValue {
  templates: CharacterTemplate[];
  isLoading: boolean;
  error: string | null;
  fetchTemplates: () => Promise<void>;
  upsertCharacterTemplate: (template: CharacterTemplate) => Promise<boolean>;
  replaceAllTemplates: (templates: CharacterTemplate[]) => Promise<boolean>;
}

const CharacterTemplateContext = createContext<CharacterTemplateContextValue | null>(null);

export function useCharacterTemplateContext(): CharacterTemplateContextValue {
  const ctx = useContext(CharacterTemplateContext);
  if (!ctx) throw new Error('useCharacterTemplateContext must be used within CharacterTemplateProvider');
  return ctx;
}

export function CharacterTemplateProvider({ children }: { children: React.ReactNode }) {
  const value = useCharacterTemplates();
  return <CharacterTemplateContext.Provider value={value}>{children}</CharacterTemplateContext.Provider>;
}
