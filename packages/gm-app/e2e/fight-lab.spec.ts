import { expect, test } from '@playwright/test';

test('assembles, edits, saves, and reloads a sandbox encounter without campaign writes', async ({ page }, testInfo) => {
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    page.on('console', message => {
        if (message.type() === 'error') console.error('BROWSER ERROR:', message.text());
    });
    await page.addInitScript(({ campaign }) => {
        window.localStorage.setItem('i18nextLng', 'en');
        const state = {
            fightLabStore: { version: 1, scenarios: [] },
            campaignSaveCalls: 0,
        };
        (window as any).__fightLabTest = state;
        (window as any).ipcRenderer = new Proxy({
            getInitialData: async () => campaign,
            saveData: () => { state.campaignSaveCalls += 1; },
            getFightLabStore: async () => structuredClone(state.fightLabStore),
            saveFightLabStore: async (store: unknown) => {
                state.fightLabStore = structuredClone(store as typeof state.fightLabStore);
                return structuredClone(state.fightLabStore);
            },
            getServerStatus: async () => ({ ip: '127.0.0.1', port: 3000, clients: [] }),
            getAudioServerPort: async () => 0,
            getAudioLibrary: async () => ({ tracks: [], playlists: [], rootPath: '' }),
            onServerStatusUpdate: () => () => undefined,
            onDataUpdated: () => () => undefined,
            onMapPingReceived: () => () => undefined,
            getChatHistory: async () => [],
            onChatMessage: () => () => undefined,
            onPlayerMessageReceived: () => () => undefined,
            sendToAllPlayers: () => undefined,
            sendToPlayer: () => undefined,
            sendChatMessage: () => undefined,
        }, {
            get(target, property) {
                if (property in target) return target[property as keyof typeof target];
                return () => undefined;
            },
        });
    }, { campaign: campaignFixture() });

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Fight Lab' })).toBeVisible();
    const baselineCampaignWrites = await page.evaluate(() => (window as any).__fightLabTest.campaignSaveCalls);
    await page.getByRole('button', { name: 'Fight Lab' }).click();
    await expect(page.getByRole('heading', { name: 'Fight Lab' })).toBeVisible();
    const lab = page.getByRole('region', { name: 'Fight Lab' });

    await lab.getByRole('button', { name: /Add combatant/ }).nth(0).click();
    await page.getByRole('button', { name: 'Current Campaign' }).click();
    await page.getByRole('button', { name: /Campaign Hero/ }).click();

    await lab.getByRole('button', { name: /Add combatant/ }).nth(0).click();
    await page.getByRole('button', { name: 'Character Library' }).click();
    await page.getByRole('button', { name: /Library Guard/ }).click();

    await lab.getByRole('button', { name: /Add combatant/ }).nth(1).click();
    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('button', { name: /Training Dummy/ }).click();

    const firstAlly = lab.locator('article').first();
    await firstAlly.getByLabel('Profile').selectOption('duellist');
    await firstAlly.getByLabel('Cover').selectOption('medium');
    await firstAlly.getByLabel('Offset').fill('3');

    await page.getByLabel('Scenario name').fill('Bridge Ambush');
    await page.getByRole('button', { name: 'Save scenario' }).click();
    const library = lab.getByRole('complementary');
    await expect(library.getByText('Bridge Ambush', { exact: true })).toBeVisible();

    await page.getByLabel('Scenario name').fill('Unsaved name');
    await library.getByRole('button', { name: /Bridge Ambush/ }).click();
    await expect(page.getByLabel('Scenario name')).toHaveValue('Bridge Ambush');
    await expect(firstAlly.getByLabel('Profile')).toHaveValue('duellist');
    await page.screenshot({ path: testInfo.outputPath('fight-lab-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Fight Lab' })).toBeVisible();
    await expect(lab.getByRole('button', { name: /Add combatant/ }).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('fight-lab-mobile.png'), fullPage: true });

    const finalCampaignWrites = await page.evaluate(() => (window as any).__fightLabTest.campaignSaveCalls);
    expect(finalCampaignWrites).toBe(baselineCampaignWrites);
});

function campaignFixture() {
    return {
        characters: [
            character('campaign-hero', 'Campaign Hero', 'user-1'),
            character('library-guard', 'Library Guard', null),
        ],
        users: [{
            id: 'user-1',
            username: 'Player',
            passwordHash: '',
            characterId: 'campaign-hero',
            createdAt: new Date(0).toISOString(),
        }],
        journal: [],
        quests: [],
        mapPinStates: {},
        factions: [],
        customShopDefinitions: [],
        shopInventory: undefined,
        characterTemplates: [{
            id: 'training-dummy',
            name: 'Training Dummy',
            category: 'Other',
            species: 'Human',
            movement: 4,
            characteristics: {
                ws: { base: 30, variance: 0 }, bs: { base: 30, variance: 0 },
                s: { base: 30, variance: 0 }, t: { base: 30, variance: 0 },
                i: { base: 30, variance: 0 }, ag: { base: 30, variance: 0 },
                dex: { base: 30, variance: 0 }, int: { base: 30, variance: 0 },
                wp: { base: 30, variance: 0 }, fel: { base: 30, variance: 0 },
            },
            skills: [{ id: 'melee_basic', advances: 5 }],
            talents: [],
            trappings: { weapons: ['weapon_basic_sword'], armor: [], items: [] },
            baseWounds: 10,
            isMinion: true,
            tags: [],
        }],
        maps: {},
        activeMapId: 'ubersreik_city',
        tokens: [],
        userPins: [],
        playerColors: {},
        locationTerritories: {},
        version: '1.1.0',
        lastModified: new Date(0).toISOString(),
    };
}

function character(id: string, name: string, userId: string | null) {
    const characteristic = (initial: number) => ({ initial, advances: 0, talents: 0, modifier: 0 });
    return {
        id,
        name,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: '',
        currentCareerLevelId: '',
        userId,
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
            ws: characteristic(40), bs: characteristic(35), s: characteristic(30), t: characteristic(30),
            i: characteristic(35), ag: characteristic(35), dex: characteristic(30), int: characteristic(30),
            wp: characteristic(30), fel: characteristic(30),
        },
        skills: [{ id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 }],
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
            weapons: { weapon_basic_sword: 1 },
            armor: {},
            items: {},
            equippedWeapons: { weapon_basic_sword: true },
            equippedArmor: {},
            equippedItems: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}
