export const rolld100 = (): number => {
    return Math.floor(Math.random() * 100) + 1;
};

export const rollDice  = (numDice: number, dieSides: number): number => {
    let total = 0;
    for (let i = 0; i < numDice; i++) {
        total += Math.floor(Math.random() * dieSides) + 1;
    }
    return total;
};

export const calculateSuccessLevel = (roll: number, target: number): number => {
    if (roll === target) return 0;
    
    const rollTens = Math.floor(roll / 10);
    const targetTens = Math.floor(target / 10);

    if (roll <= 5)
        return Math.max(1, targetTens - rollTens);
    if (roll > 95)
        return -1 * Math.max(1, rollTens - targetTens);

    if (rollTens === targetTens)
        return roll > target ? -0.1 : 0.1;

    return targetTens - rollTens;
};

export const getHitLocation = (roll: number): string => {
    const hitLocations = [
        'Head',
        'Right Arm',
        'Left Arm',
        'Body',
        'Right Leg',
        'Left Leg'
    ];
    let reversedRoll = roll.toString().split('').reverse().join('');
    if (roll < 10) reversedRoll = roll.toString() + '0';
    if (roll === 100) reversedRoll = '100';

    const hitRoll = parseInt(reversedRoll, 10);

    if (hitRoll >=  1 && hitRoll < 10) return hitLocations[0];
    if (hitRoll >= 10 && hitRoll < 25) return hitLocations[1];
    if (hitRoll >= 25 && hitRoll < 45) return hitLocations[2];
    if (hitRoll >= 45 && hitRoll < 80) return hitLocations[3];
    if (hitRoll >= 80 && hitRoll < 90) return hitLocations[4];
    if (hitRoll >= 90 && hitRoll <= 100) return hitLocations[5];
    return 'Unknown';
}
