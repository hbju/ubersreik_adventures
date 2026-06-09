import {
    createFightDebugFixture,
    type FightDebugFixture,
    type FightDebugFixtureInput,
} from '@wfrp/shared';

export function exportFightForDebugging(
    input: FightDebugFixtureInput,
    scenarioName: string
): FightDebugFixture {
    const fixture = createFightDebugFixture(input);
    const suffix = input.index === undefined ? String(input.seed) : `${input.index}-${String(input.seed)}`;
    downloadJson(fixture, `${slug(scenarioName)}-${slug(suffix)}.fight.json`);
    return fixture;
}

function downloadJson(value: unknown, filename: string): void {
    const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function slug(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'fight';
}
