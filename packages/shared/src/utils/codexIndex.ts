// ─── Codex Index Builder ─────────────────────────────────────────────────────
// Aggregates all game data (JSON + Markdown) into a flat CodexEntry[] array.

import type { CodexEntry, CodexCategory } from '../types/codex.types';
import type {
  Talent,
  SkillCharDefinition,
  Career,
  Condition,
  ItemQualityDefinition,
} from '../types/wfrp.types';

// ── Markdown loader (Vite import.meta.glob) ─────────────────────────────────
// These globs are resolved at *build time* by Vite.  The `eager: true, as: 'raw'`
// combination means each .md file is inlined as a string in the bundle.
const markdownModules: Record<string, string> = import.meta.glob(
  '../data/codex/**/*.md',
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function categoryFromPath(path: string): CodexCategory {
  if (path.includes('/combat/')) return 'combat';
  if (path.includes('/magic/')) return 'magic';
  if (path.includes('/mechanics/')) return 'core-rules';
  if (path.includes('/general/')) return 'core-rules';
  return 'core-rules';
}

function subcategoryFromPath(path: string): string | undefined {
  const match = path.match(/codex\/([^/]+)\//);
  return match ? match[1] : undefined;
}

function titleFromFilename(path: string): string {
  const file = path.split('/').pop()?.replace('.md', '') ?? '';
  return file
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapTalents(talents: Talent[]): CodexEntry[] {
  return talents.map((t) => ({
    id: `talent:${t.id}`,
    title: t.name,
    category: 'talents' as CodexCategory,
    type: 'json' as const,
    content: t,
    tags: [
      t.name,
      ...(t.tests ?? []),
      ...(t.effects?.map((e) => e.type) ?? []),
      ...(t.racial ?? []),
      ...Object.keys(t.careers ?? {}),
    ],
  }));
}

function mapSkills(skills: SkillCharDefinition[]): CodexEntry[] {
  return skills
    .filter((s) => s.type === 'skill') // skip raw characteristics
    .map((s) => ({
      id: `skill:${s.id}`,
      title: s.name,
      category: 'skills' as CodexCategory,
      type: 'json' as const,
      content: s,
      tags: [s.name, s.characteristic, s.classification ?? ''].filter(Boolean),
    }));
}

function mapCareers(careers: Career[]): CodexEntry[] {
  return careers.map((c) => ({
    id: `career:${c.id}`,
    title: c.name,
    category: 'careers' as CodexCategory,
    type: 'json' as const,
    content: c,
    tags: [
      c.name,
      c.class ?? '',
      ...(c.races ?? []),
      ...(c.career_level?.flatMap((lvl) => [
        lvl.name,
        ...(lvl.skills_ids ?? []),
        ...(lvl.talent_ids ?? []),
      ]) ?? []),
    ].filter(Boolean),
  }));
}

function mapConditions(conditions: Condition[]): CodexEntry[] {
  return conditions.map((c) => ({
    id: `condition:${c.id}`,
    title: c.name,
    category: 'conditions' as CodexCategory,
    type: 'json' as const,
    content: c,
    tags: [c.name],
  }));
}

function mapQualities(qualities: ItemQualityDefinition[]): CodexEntry[] {
  return qualities.map((q) => ({
    id: `quality:${q.id}`,
    title: q.name,
    category: 'qualities' as CodexCategory,
    subcategory: q.type === 'quality' ? 'Qualities' : 'Flaws',
    type: 'json' as const,
    content: q,
    tags: [q.name, q.type, q.equipment ?? ''].filter(Boolean),
  }));
}

function mapMarkdownFiles(): CodexEntry[] {
  const entries: CodexEntry[] = [];
  for (const [path, raw] of Object.entries(markdownModules)) {
    entries.push({
      id: `md:${path.replace('../data/codex/', '').replace('.md', '')}`,
      title: titleFromFilename(path),
      category: categoryFromPath(path),
      subcategory: subcategoryFromPath(path),
      type: 'markdown',
      content: raw,
      tags: [titleFromFilename(path)],
    });
  }
  return entries;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface CodexDataSources {
  talents: Talent[];
  skills: SkillCharDefinition[];
  careers: Career[];
  conditions: Condition[];
  qualities: ItemQualityDefinition[];
}

/**
 * Build the complete codex index from all available data sources.
 * Call once per language switch – the result is a flat array of CodexEntry.
 */
export function buildCodexIndex(sources: CodexDataSources): CodexEntry[] {
  return [
    ...mapTalents(sources.talents),
    ...mapSkills(sources.skills),
    ...mapCareers(sources.careers),
    ...mapConditions(sources.conditions),
    ...mapQualities(sources.qualities),
    ...mapMarkdownFiles(),
  ];
}
