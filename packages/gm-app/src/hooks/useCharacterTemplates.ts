import { useCallback, useEffect, useState } from 'react';
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
  type CharacterTemplate,
} from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

export function useCharacterTemplates() {
  const { serviceContext } = useAppContext();
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!serviceContext) return;
    setIsLoading(true);
    setError(null);
    const result = await getTemplates(serviceContext.client, serviceContext.campaignId);
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    const mapped = result.data.map((row) => {
      const payload = (row.template_data ?? {}) as CharacterTemplate;
      return {
        ...payload,
        id: row.id,
        name: row.name,
        category: (row.category as CharacterTemplate['category']) ?? payload.category,
      };
    });
    setTemplates(mapped);
    setIsLoading(false);
  }, [serviceContext]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const upsertCharacterTemplate = useCallback(async (template: CharacterTemplate) => {
    if (!serviceContext) return false;
    const existing = templates.find((t) => t.id === template.id);
    if (existing) {
      const result = await updateTemplate(serviceContext.client, template.id, {
        name: template.name,
        category: template.category,
        template_data: template as any,
      });
      if (result.error) {
        setError(result.error.message);
        return false;
      }
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)));
      setError(null);
      return true;
    }

    const result = await createTemplate(serviceContext.client, serviceContext.campaignId, {
      name: template.name,
      category: template.category,
      template_data: template as any,
    });
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    setTemplates((prev) => [...prev, { ...template, id: result.data.id }]);
    setError(null);
    return true;
  }, [serviceContext, templates]);

  const replaceAllTemplates = useCallback(async (next: CharacterTemplate[]) => {
    const previousById = new Map(templates.map((t) => [t.id, t]));

    for (const template of next) {
      // eslint-disable-next-line no-await-in-loop
      await upsertCharacterTemplate(template);
    }

    const removed = templates.filter((existing) => !next.some((incoming) => incoming.id === existing.id));
    for (const removedTemplate of removed) {
      if (!serviceContext) continue;
      // eslint-disable-next-line no-await-in-loop
      const result = await deleteTemplate(serviceContext.client, removedTemplate.id);
      if (result.error) {
        setError(result.error.message);
        return false;
      }
    }

    const normalized = next.map((t) => previousById.get(t.id) ? t : t);
    setTemplates(normalized);
    setError(null);
    return true;
  }, [serviceContext, templates, upsertCharacterTemplate]);

  return {
    templates,
    isLoading,
    error,
    fetchTemplates,
    upsertCharacterTemplate,
    replaceAllTemplates,
  };
}
