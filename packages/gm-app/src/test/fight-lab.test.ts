import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    aggregateBatchResult,
    validateEncounterConfig,
    type BatchResult,
    type Character,
    type Weapon,
} from '@wfrp/shared';
import {
    addCharacterToScenario,
    cacheScenarioReport,
    createEmptyScenario,
    proficiencyWarnings,
    updateCombatant,
} from '../fight-lab/model';
import {
    fightLabFilePath,
    loadFightLabStoreAt,
    saveFightLabStoreAt,
} from '../../electron/main/fightLabStore';

const sword = weapon('test-sword', 'basic', ['damaging']);
const bow = weapon('test-bow', 'bow', ['accurate']);

describe('Fight Lab sandbox', () => {
    it('builds an encounter config accepted by the shared validator', () => {
        let scenario = createEmptyScenario('Validation fixture');
        scenario = addCharacterToScenario(scenario, character('hero', ['test-sword'], true), 'ally');
        scenario = addCharacterToScenario(scenario, character('foe', ['test-sword'], true), 'adversary');
        scenario.config.catalogue = { weapons: [sword], armor: [], talents: [], skills: [] };

        expect(validateEncounterConfig(scenario.config)).toEqual({ valid: true, errors: [] });
    });

    it('deep-clones a source character before sandbox edits', () => {
        const source = character('source', ['test-sword'], true);
        let scenario = addCharacterToScenario(createEmptyScenario(), source, 'ally');
        const member = scenario.config.sides.ally[0];
        scenario = updateCombatant(scenario, 'ally', member.id, {
            character: {
                ...(member.character as Character),
                name: 'Sandbox Copy',
                status: {
                    ...(member.character as Character).status,
                    wounds: { current: 1, max: 12 },
                },
            },
        });

        expect(source.name).toBe('source');
        expect(source.status.wounds.current).toBe(12);
        expect((scenario.config.sides.ally[0].character as Character).name).toBe('Sandbox Copy');
    });

    it('round-trips self-contained scenarios through fight-lab.json', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fight-lab-'));
        const filePath = fightLabFilePath(tempDir);
        let scenario = addCharacterToScenario(createEmptyScenario('Saved encounter'), character('hero', ['test-sword'], true), 'ally');
        const batch: BatchResult = {
            outcomes: [],
            failures: [{ index: 7, seed: 'broken-seed', error: 'fixture failure' }],
            completedCount: 1,
            masterSeed: 'master-seed',
            range: [0, 1],
            config: scenario.config,
            cancelled: true,
        };
        scenario = cacheScenarioReport(scenario, {
            report: aggregateBatchResult(batch),
            masterSeed: batch.masterSeed,
            iterations: 10,
            failures: batch.failures,
            partial: true,
            completedAt: new Date(0).toISOString(),
        });
        const store = { version: 1 as const, scenarios: [scenario], selectedScenarioId: scenario.id };

        saveFightLabStoreAt(filePath, store);
        const loaded = loadFightLabStoreAt(filePath);

        expect(path.basename(filePath)).toBe('fight-lab.json');
        expect(fs.existsSync(path.join(tempDir, 'campaign-state.json'))).toBe(false);
        expect(loaded).toEqual(store);
        expect((loaded.scenarios[0].config.sides.ally[0].character as Character).name).toBe('hero');
        expect(loaded.scenarios[0].cachedReport).toEqual(scenario.cachedReport);
    });

    it('reports lost Qualities and unusable ranged weapons from the shared proficiency resolver', () => {
        const untrained = character('untrained', ['test-sword', 'test-bow'], false);
        const member = {
            id: 'untrained',
            character: untrained,
            primaryWeaponId: 'test-sword',
            secondaryWeaponId: 'test-bow',
        };
        const warnings = proficiencyWarnings(member, 'ally', [sword, bow]);

        expect(warnings).toEqual(expect.arrayContaining([
            expect.objectContaining({ weaponId: 'test-sword', severity: 'warning' }),
            expect.objectContaining({ weaponId: 'test-bow', severity: 'error' }),
        ]));
    });

    it('does not warn for a trained equipped weapon', () => {
        const trained = character('trained', ['test-sword'], true);
        const warnings = proficiencyWarnings({
            id: 'trained',
            character: trained,
            primaryWeaponId: 'test-sword',
        }, 'ally', [sword]);

        expect(warnings).toEqual([]);
    });
});

function character(id: string, weaponIds: string[], trained: boolean): Character {
    const characteristic = (initial: number) => ({ initial, advances: 0, talents: 0, modifier: 0 });
    return {
        id,
        name: id,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: '',
        currentCareerLevelId: '',
        userId: null,
        tags: [],
        locationId: null,
        xp: { current: 0, spent: 0 },
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        details: {
            age: '', height: '', hair: '', eyes: '', partyName: '',
            shortTermAmbition: '', longTermAmbition: '', partyShortTermAmbition: '', partyLongTermAmbition: '',
        },
        movement: 4,
        characteristics: {
            ws: characteristic(40), bs: characteristic(40), s: characteristic(30), t: characteristic(30),
            i: characteristic(30), ag: characteristic(30), dex: characteristic(30), int: characteristic(30),
            wp: characteristic(30), fel: characteristic(30),
        },
        skills: trained
            ? [{ id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 }]
            : [],
        status: {
            wounds: { current: 12, max: 12 },
            fate: { current: 1, max: 1 },
            fortune: { current: 1, max: 1 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 10 },
        },
        conditions: [],
        talents: {},
        inventory: {
            weapons: Object.fromEntries(weaponIds.map(weaponId => [weaponId, 1])),
            armor: {},
            items: {},
            equippedWeapons: Object.fromEntries(weaponIds.map(weaponId => [weaponId, true])),
            equippedArmor: {},
            equippedItems: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}

function weapon(id: string, group: string, qualities: string[]): Weapon {
    return {
        id,
        name: id,
        group,
        price: '1 GC',
        enc: 1,
        reach: group === 'bow' ? '50' : 'Average',
        damage: '+SB+4',
        qualities,
        availability: 'Common',
    };
}
