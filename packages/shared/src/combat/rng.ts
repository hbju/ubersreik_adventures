export interface Rng {
    next(): number;
    /** Return a new Rng that produces the same sequence from the current position. */
    clone?(): Rng;
}

export const mathRandomRng: Rng = {
    next: () => Math.random(),
};

function hashSeed(seed: string): number {
    let hash = 1779033703 ^ seed.length;
    for (let index = 0; index < seed.length; index++) {
        hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
        hash = (hash << 13) | (hash >>> 19);
    }

    return hash >>> 0;
}

function makeRngFromState(initialState: number): Rng {
    let state = initialState;
    const rng: Rng = {
        next: () => {
            state += 0x6D2B79F5;
            let value = state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        },
        clone: () => makeRngFromState(state),
    };
    return rng;
}

export function createSeededRng(seed: number | string): Rng {
    const initialState = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
    return makeRngFromState(initialState);
}
