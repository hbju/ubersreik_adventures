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
        (window as any).__fightLabWorkerCount = 1;
        (window as any).__fightLabWorkerFactory = () => {
            let terminated = false;
            let cancelled = false;
            const worker = {
                onmessage: null as ((event: { data: unknown }) => void) | null,
                onerror: null as ((event: { message?: string; error?: unknown }) => void) | null,
                postMessage(message: any) {
                    if (message.type === 'cancel') {
                        cancelled = true;
                        return;
                    }
                    const { runId, task } = message;
                    const { config, masterSeed, range } = task.payload;
                    const totalCount = range[1] - range[0];
                    setTimeout(() => {
                        if (terminated) return;
                        worker.onmessage?.({
                            data: {
                                type: 'progress',
                                runId,
                                progress: {
                                    taskId: task.id,
                                    completedCount: Math.min(5, totalCount),
                                    totalCount,
                                    detail: {
                                        completedCount: Math.min(5, totalCount),
                                        totalCount,
                                        successfulCount: Math.min(5, totalCount),
                                        failureCount: 0,
                                        cancelled: false,
                                        winRates: { ally: 0.6, adversary: 0.2, draw: 0.2 },
                                    },
                                },
                            },
                        });
                    }, 30);
                    setTimeout(() => {
                        if (terminated) return;
                        const failure = { index: 7, seed: 'failure-seed-7', error: 'Fixture fight failed' };
                        const includesFailure = range[0] <= 7 && 7 < range[1];
                        const outcomes = [];
                        for (let index = range[0]; index < range[1]; index += 1) {
                            if (index === 7) continue;
                            const allyCutoff = config.toggles?.maxRounds === 4 ? 2 : 8;
                            const winner = index % 10 < allyCutoff
                                ? 'ally'
                                : index % 10 === 9 ? 'draw' : 'adversary';
                            outcomes.push(indexedOutcome(
                                index,
                                `${masterSeed}:${index}:fixture`,
                                winner,
                                2 + index % 7,
                                config,
                                winner === 'adversary'
                            ));
                        }
                        worker.onmessage?.({
                            data: {
                                type: 'complete',
                                runId,
                                taskId: task.id,
                                result: {
                                    result: {
                                        outcomes,
                                        failures: includesFailure ? [failure] : [],
                                        completedCount: cancelled ? Math.min(5, totalCount) : totalCount,
                                        masterSeed,
                                        range,
                                        config,
                                        cancelled,
                                    },
                                },
                            },
                        });
                    }, 1_200);
                },
                terminate() {
                    terminated = true;
                },
            };
            return worker;
        };

        function metricReport(
            failure: { index: number; seed: string; error: string },
            partial: boolean,
            config: any
        ) {
            const sampleSize = partial ? 5 : 400;
            const tweaked = config.toggles?.maxRounds === 4;
            const rate = (count: number) => {
                const value = count / sampleSize;
                return {
                    i18nKey: '',
                    count,
                    sampleSize,
                    rate: value,
                    ci: {
                        lower: Math.max(0, value - 0.12),
                        upper: Math.min(1, value + 0.12),
                        halfWidth: 0.12,
                        confidence: 0.95,
                    },
                };
            };
            const average = (value: number) => ({
                i18nKey: '',
                total: value * sampleSize,
                average: value,
                sampleSize,
            });
            const distribution = (values: number[]) => ({
                i18nKey: '',
                count: sampleSize,
                mean: values[2],
                median: values[2],
                percentiles: {
                    p10: values[0],
                    p25: values[1],
                    p50: values[2],
                    p75: values[3],
                    p90: values[4],
                },
                min: values[0],
                max: values[4],
                histogram: [
                    { min: values[0], maxExclusive: values[1], count: 3 },
                    { min: values[1], maxExclusive: values[3], count: 11 },
                    { min: values[3], maxExclusive: values[4] + 1, count: 5 },
                ],
            });
            const sideOutcome = (wins: number, losses: number, draws: number) => ({
                i18nKey: '',
                winRate: rate(wins),
                lossRate: rate(losses),
                drawRate: rate(draws),
            });
            const risk = (defeated: number, deaths: number, allDead: number) => ({
                i18nKey: '',
                partyDefeatedRate: rate(defeated),
                atLeastOneDeathRate: rate(deaths),
                allDeadRate: rate(allDead),
            });
            const combatant = (id: string, name: string, side: 'ally' | 'adversary', survived: number) => ({
                i18nKey: '',
                id,
                name,
                side,
                survivalRate: rate(survived),
                deathRate: rate(sampleSize - survived),
                finalWoundsAmongSurvivors: distribution([1, 3, 5, 7, 10]),
                critsDealt: average(0.7),
                critsTaken: average(0.4),
                conditionsInflicted: average(0.6),
                fateSpent: average(0.2),
                fateBurnRate: rate(4),
                fortuneSpent: average(0.8),
                advantageGenerated: average(3.2),
                damageDealt: average(8.6),
                damageTaken: average(5.1),
            });
            return {
                i18nKey: '',
                completedCount: sampleSize + 1,
                successfulCount: sampleSize,
                failureCount: 1,
                failures: [failure],
                sufficientSample: tweaked,
                sufficientNHalfWidth: 0.05,
                sideOutcomes: {
                    ally: sideOutcome(tweaked ? 80 : 320, tweaked ? 280 : 40, 40),
                    adversary: sideOutcome(tweaked ? 280 : 40, tweaked ? 80 : 320, 40),
                },
                rounds: distribution([2, 3, 4, 6, 8]),
                combatants: {
                    hero: combatant('hero', 'Campaign Hero', 'ally', tweaked ? 120 : 360),
                    dummy: combatant('dummy', 'Training Dummy', 'adversary', tweaked ? 330 : 80),
                },
                sideRisk: {
                    ally: risk(6, 5, 2),
                    adversary: risk(11, 9, 6),
                },
                decisiveness: {
                    i18nKey: '',
                    averageWinningSideSurvivors: average(1.6),
                    roundsByOutcome: {
                        ally: distribution([2, 3, 4, 5, 7]),
                        adversary: distribution([2, 4, 5, 6, 8]),
                        draw: distribution([4, 5, 6, 7, 8]),
                    },
                },
            };
        }

        function indexedOutcome(
            index: number,
            seed: string,
            winner: 'ally' | 'adversary' | 'draw',
            rounds: number,
            config: any,
            allyDied = false
        ) {
            const combatants = Object.fromEntries(
                [...config.sides.ally.map((member: any) => ({ member, side: 'ally' })),
                    ...config.sides.adversary.map((member: any) => ({ member, side: 'adversary' }))]
                    .map(({ member, side }: any) => [member.id, {
                        id: member.id,
                        name: member.character.name,
                        side,
                        survived: side !== 'ally' || !allyDied,
                        finalWounds: side === 'ally' && allyDied ? 0 : 5,
                        died: side === 'ally' && allyDied,
                        critsDealt: 0,
                        critsTaken: 0,
                        conditionsInflicted: 0,
                        fateSpent: 0,
                        fortuneSpent: 0,
                        advantageGenerated: 0,
                    }])
            );
            return {
                index,
                seed,
                outcome: {
                    seed,
                    winner,
                    rounds,
                    terminalReason: winner === 'draw' ? 'maxRounds' : 'sideDown',
                    combatants,
                    sideResources: {
                        ally: { fateSpent: 0, fortuneSpent: 0, advantageGenerated: 0, advantageSpent: 0 },
                        adversary: { fateSpent: 0, fortuneSpent: 0, advantageGenerated: 0, advantageSpent: 0 },
                    },
                },
            };
        }
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
    await page.getByLabel('Maximum rounds').fill('3');

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

    await page.setViewportSize({ width: 1440, height: 1000 });
    await lab.getByRole('button', { name: 'Run', exact: true }).click();
    await lab.getByRole('button', { name: 'Run simulation' }).click();
    const progressbar = lab.getByRole('progressbar');
    await expect(progressbar).toBeVisible();
    await expect(progressbar).toHaveAttribute('aria-valuenow', '5');
    await expect(lab.getByRole('heading', { name: 'Results Dashboard' })).toBeVisible();
    await expect(lab.getByText(/95% CI/).first()).toBeVisible();
    await expect(lab.getByText('The current sample is inconclusive.')).toBeVisible();
    await expect(lab.getByRole('button', { name: /failure-seed-7/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('fight-lab-dashboard.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(lab.getByRole('heading', { name: 'Results Dashboard' })).toBeVisible();
    await expect(lab.getByText(/95% CI/).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('fight-lab-dashboard-mobile.png'), fullPage: true });

    await lab.getByRole('button', { name: /failure-seed-7/ }).click();
    await expect(lab.getByRole('heading', { name: 'Fight Replay' })).toBeVisible();
    await expect(lab.getByLabel('1D Battlefield')).toBeVisible();
    await expect(lab.getByRole('heading', { name: 'Combatant State' })).toBeVisible();
    await expect(lab.getByRole('heading', { name: 'Event Narration' })).toBeVisible();
    await expect(lab.getByText(/Seed failure-seed-7/)).toBeVisible();
    await lab.getByLabel('1D Battlefield').screenshot({ path: testInfo.outputPath('fight-lab-battlefield.png') });

    const frameLabel = lab.getByText(/Frame \d+ \/ \d+ \/ Round \d+/);
    await expect(frameLabel).toContainText('Frame 1');
    await lab.getByTitle('Next step').click();
    await expect(frameLabel).toContainText('Frame 2');
    await lab.getByTitle('Previous step').click();
    await expect(frameLabel).toContainText('Frame 1');
    await lab.getByTitle('Next round').click();
    await expect(frameLabel).toContainText('Round 1');
    await lab.getByTitle('Next step').click();
    await expect(lab.getByRole('heading', { name: 'AI Decision' })).toBeVisible();
    await expect(lab.getByText('Chosen')).toBeVisible();
    await expect(lab.getByText('Rejected', { exact: true })).toBeVisible();

    await lab.getByRole('button', { name: 'Replay a draw' }).click();
    await expect(lab.getByText(/Seed .*:1:/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('fight-lab-replay.png'), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await lab.getByRole('button', { name: 'Configure', exact: true }).click();
    await library.getByTitle('Duplicate').click();
    await page.getByLabel('Scenario name').fill('Bridge Ambush Tweaked');
    await page.getByLabel('Maximum rounds').fill('4');
    await page.getByRole('button', { name: 'Save scenario' }).click();
    await lab.getByRole('button', { name: 'Run', exact: true }).click();
    await lab.getByRole('button', { name: 'Run simulation' }).click();
    await expect(lab.getByRole('heading', { name: 'Results Dashboard' })).toBeVisible();

    await lab.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(lab.getByRole('heading', { name: 'Scenario Comparison' })).toBeVisible();
    await expect(lab.getByLabel('Scenario A')).toHaveValue(/.+/);
    await expect(lab.getByLabel('Scenario B')).toHaveValue(/.+/);
    const winRateRow = lab.getByRole('row').filter({ hasText: 'Win Rate' }).first();
    await expect(winRateRow).toHaveAttribute('data-signal', 'significant');
    await expect(winRateRow.getByText('Significant at 95%')).toBeVisible();
    const drawRateRow = lab.getByRole('row').filter({ hasText: 'Draw Rate' }).first();
    await expect(drawRateRow).toHaveAttribute('data-signal', 'noise');
    await expect(drawRateRow.getByText('Not significant')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('fight-lab-comparison.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(lab.getByLabel('Scenario Comparison')).toBeVisible();
    await expect(winRateRow).toHaveAttribute('data-signal', 'significant');
    await page.screenshot({ path: testInfo.outputPath('fight-lab-comparison-mobile.png'), fullPage: true });

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
