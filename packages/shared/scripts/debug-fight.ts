import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    isExpectedError,
    parseFightDebugFixture,
    runFightDebugFixture,
} from '../src/combat/fight-debug';

const fixturePath = process.argv[2];
if (!fixturePath) {
    throw new Error('Usage: npm run debug:fight -w @wfrp/shared -- <path-to-fight.json>');
}

const absolutePath = resolve(process.cwd(), fixturePath);
const fixture = parseFightDebugFixture(readFileSync(absolutePath, 'utf8'));
const result = runFightDebugFixture(fixture);
const summary = isExpectedError(result)
    ? `expected error: ${result.error}`
    : `${result.winner} after ${result.rounds} rounds`;

console.log(`Fight debug fixture matched (${summary}).`);
