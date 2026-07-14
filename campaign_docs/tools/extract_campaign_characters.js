#!/usr/bin/env node

/**
 * Read-only planning summary for the GM app's campaign-state.json.
 *
 * Usage:
 *   node tools/extract_campaign_characters.js
 *   node tools/extract_campaign_characters.js --include "Gunnar Brederson"
 *   node tools/extract_campaign_characters.js --names "Pieter Schmidt,Kaspar Schmidt"
 *   node tools/extract_campaign_characters.js --json path/to/campaign-state.json
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function namesFrom(value) {
  return (value || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

const defaultStatePath = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  '@wfrp',
  'gm-app',
  'campaign-state.json',
);
const statePath = path.resolve(argument('--json') || defaultStatePath);
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const characters = Array.isArray(state.characters) ? state.characters : [];
const users = Array.isArray(state.users) ? state.users : [];

// A user may still point to a retired/dead PC, so the default campaign party is
// deliberately explicit. --names replaces it; --include appends guests/NPCs.
const defaultParty = [
  'Pieter Schmidt',
  'Kaspar Schmidt',
  "Thucydion Asreil'ila",
  'Ludwig Riemann',
  'Silas Vane',
];
const selectedNames = argument('--names')
  ? namesFrom(argument('--names'))
  : [...defaultParty, ...namesFrom(argument('--include'))];

function value(entry) {
  return (entry?.initial || 0) + (entry?.talents || 0) +
    (entry?.advances || 0) + (entry?.modifier || 0);
}

function pool(entry) {
  if (!entry) return '—';
  return `${entry.current ?? '?'} / ${entry.max ?? '?'}`;
}

function listConditions(character) {
  return (character.conditions || []).map((condition) => {
    if (typeof condition === 'string') return condition;
    const label = condition.name || condition.id || 'Unnamed condition';
    const count = condition.count ?? condition.stacks ?? condition.value;
    return count == null ? label : `${label} ×${count}`;
  });
}

function advancedSkills(character) {
  return (character.skills || [])
    .filter((skill) => (skill.advances || 0) > 0 || (skill.modifier || 0) !== 0)
    .map((skill) => {
      const characteristic = value(character.characteristics?.[skill.characteristic]);
      const total = characteristic + (skill.advances || 0) + (skill.modifier || 0);
      return `${skill.name} ${total} (${skill.advances || 0} advances)`;
    })
    .sort();
}

function rankedTalents(character) {
  return Object.entries(character.talents || {})
    .filter(([, rank]) => Number(rank) > 0)
    .map(([id, rank]) => `${id} ${rank}`)
    .sort();
}

function inventoryNames(character) {
  const inventory = character.inventory || {};
  const keys = ['weapons', 'armor', 'items'];
  return keys.flatMap((key) => Object.entries(inventory[key] || {}).map(([id, item]) => {
    if (typeof item === 'string') return item;
    if (item === true || item == null) return id;
    const quantity = item.quantity && item.quantity !== 1 ? ` ×${item.quantity}` : '';
    return `${item.name || item.id || id}${quantity}`;
  }));
}

function compact(text, maximum = 600) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  return normalized.length > maximum ? `${normalized.slice(0, maximum)}…` : normalized;
}

function playerName(character) {
  return users.find((user) => user.id === character.userId)?.username || 'NPC / unassigned';
}

console.log(`# Campaign character summary`);
console.log(`Source: ${statePath}`);
console.log(`State version: ${state.version || 'unknown'}; last modified: ${state.lastModified || 'unknown'}\n`);

for (const requestedName of selectedNames) {
  const character = characters.find(
    (candidate) => candidate.name.toLocaleLowerCase() === requestedName.toLocaleLowerCase(),
  );
  if (!character) {
    console.warn(`## ${requestedName}\nWARNING: character not found.\n`);
    continue;
  }

  const status = character.status || {};
  const xp = character.xp || {};
  const currency = character.currency || {};
  const conditions = listConditions(character);
  const skills = advancedSkills(character);
  const talents = rankedTalents(character);
  const inventory = inventoryNames(character);
  const notes = [character.lore?.gmNotes, character.lore?.playerNotes].filter(Boolean);

  console.log(`## ${character.name}`);
  console.log(`Player: ${playerName(character)} | Species: ${character.species || '—'} | Class: ${character.class || '—'} | Career: ${character.currentCareerId || '—'}`);
  console.log(`Wounds: ${pool(status.wounds)} | Fate: ${pool(status.fate)} | Fortune: ${pool(status.fortune)}`);
  console.log(`Resolve: ${pool(status.resolve)} | Resilience: ${pool(status.resilience)} | Corruption: ${pool(status.corruption)}`);
  console.log(`XP: ${xp.current ?? '—'} current, ${xp.spent ?? '—'} spent | Money: ${currency.gc || 0} GC, ${currency.ss || 0} SS, ${currency.bp || 0} BP`);
  console.log(`Conditions: ${conditions.join(', ') || 'none recorded'}`);
  console.log(`Advanced skills: ${skills.join('; ') || 'none recorded'}`);
  console.log(`Talents: ${talents.join(', ') || 'none recorded'}`);
  console.log(`Inventory: ${inventory.join(', ') || 'none recorded'}`);
  if (notes.length) console.log(`Notes (abridged): ${compact(notes.join(' | '))}`);
  console.log('');
}
