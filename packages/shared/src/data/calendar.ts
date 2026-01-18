/**
 * Imperial Calendar System for Warhammer Fantasy Roleplay
 * 
 * The Empire uses a calendar with:
 * - 8-day weeks
 * - 12 months of varying lengths (32-33 days each)
 * - Year typically starting at 2500+ IC (Imperial Calendar)
 */

// ========================================
// Calendar Constants
// ========================================

export const MONTHS = [
    { name: 'Hexenstag', days: 1 },     // Witching, New Year
    { name: 'Nachexen', days: 32 },     // After Witching, Month 1
    { name: 'Jahrdrung', days: 33 },    // Year-turn, Month 2
    { name: 'Mitterfruhl', days: 1 },   // Mid-spring, Spring Equinox
    { name: 'Pflugzeit', days: 33 },    // Ploughtide, Month 3
    { name: 'Sigmarzeit', days: 33 },   // Sigmar-time, Month 4
    { name: 'Sommerzeit', days: 33 },   // Summertide, Month 5
    { name: 'Sonnstill', days: 1 },     // Sun-still, Summer Solstice
    { name: 'Vorgeheim', days: 33 },    // Fore-mystery, Month 6
    { name: 'Geheimnistag', days: 1 },  // Day of Mystery
    { name: 'Nachgeheim', days: 32 },   // After-mystery, Month 7
    { name: 'Erntezeit', days: 33 },    // Harvest-tide, Month 8
    { name: 'Mittherbst', days: 1 },    // Mid-autumn, Autumn Equinox
    { name: 'Brauzeit', days: 33 },     // Brew-tide, Month 9
    { name: 'Kaldezeit', days: 33 },    // Chill-tide, Month 10
    { name: 'Ulriczeit', days: 33 },    // Ulric-tide, Month 11
    { name: 'Mondstill', days: 1 },     // Moon-still, Winter Solstice
    { name: 'Vorhexen', days: 33 }      // Fore-witching, Month 12
] as const;

export const WEEKDAYS = [
    'Wellentag',  // Workday (Day 1)
    'Aubentag',   // Levyday (Day 2)
    'Marktag',    // Marketday (Day 3)
    'Backertag',  // Bakeday (Day 4)
    'Bezahltag',  // Taxday (Day 5)
    'Konistag',   // Kingday (Day 6)
    'Angestag',   // Startweek (Day 7)
    'Festag'      // Holiday (Day 8)
] as const;

// Season mappings (for weather generation)
export const SEASONS = {
    WINTER: [0, 1, 2, 15, 16, 17],     // Nachexen, Jahrdrung, Ulriczeit, Vorhexen
    SPRING: [3, 4, 5],              // Pflugzeit, Sigmarzeit
    SUMMER: [6, 7, 8, 9, 10],           // Sommerzeit, Vorgeheim, Nachgeheim
    AUTUMN: [11, 12, 13, 14]            // Erntezeit, Brauzeit
} as const;

// Total days in a year
export const DAYS_IN_YEAR = MONTHS.reduce((sum, month) => sum + month.days, 0);

// ========================================
// Types
// ========================================

export interface GameDate {
    year: number;
    monthIndex: number; // 0-11
    day: number;        // 1-32 or 1-33 depending on month
}

export interface TimelineEvent {
    id: string;
    date: GameDate;
    title: string;
    description: string;
    tags: string[];
    color?: string;       // Hex color for display
    isHidden?: boolean;   // Hidden from players
}

export interface CalendarState {
    currentDate: GameDate;
    events: TimelineEvent[];
    eventTags: string[];  // Available tags for filtering
    currentWeather?: string;
}

export type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'AUTUMN';

// ========================================
// Date Utilities
// ========================================

/**
 * Compare two dates
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareDates(a: GameDate, b: GameDate): -1 | 0 | 1 {
    if (a.year !== b.year) {
        return a.year < b.year ? -1 : 1;
    }
    if (a.monthIndex !== b.monthIndex) {
        return a.monthIndex < b.monthIndex ? -1 : 1;
    }
    if (a.day !== b.day) {
        return a.day < b.day ? -1 : 1;
    }
    return 0;
}

/**
 * Check if two dates are equal
 */
export function datesEqual(a: GameDate, b: GameDate): boolean {
    return a.year === b.year && a.monthIndex === b.monthIndex && a.day === b.day;
}

/**
 * Add days to a date, handling month/year rollover
 */
export function addDays(date: GameDate, amount: number): GameDate {
    let { year, monthIndex, day } = { ...date };

    // Handle negative amounts
    if (amount < 0) {
        return subtractDays(date, Math.abs(amount));
    }

    day += amount;

    // Handle overflow
    while (day > MONTHS[monthIndex].days) {
        day -= MONTHS[monthIndex].days;
        monthIndex++;

        if (monthIndex >= 12) {
            monthIndex = 0;
            year++;
        }
    }

    return { year, monthIndex, day };
}

/**
 * Subtract days from a date, handling month/year rollover
 */
export function subtractDays(date: GameDate, amount: number): GameDate {
    let { year, monthIndex, day } = { ...date };

    day -= amount;

    // Handle underflow
    while (day < 1) {
        monthIndex--;

        if (monthIndex < 0) {
            monthIndex = 11;
            year--;
        }

        day += MONTHS[monthIndex].days;
    }

    return { year, monthIndex, day };
}

/**
 * Get the day of the week (0-7 index)
 * Assumes Wellentag is day 1 of month 1
 */
export function getDayOfWeek(date: GameDate): number {
    let totalDays = 0;

    // Add all days from previous months in the current year
    for (let i = 0; i < date.monthIndex; i++) {
        totalDays += MONTHS[i].days;
    }

    // Add the current day
    totalDays += date.day - 1;

    return totalDays % 8;
}

/**
 * Get the weekday name for a date
 */
export function getWeekdayName(date: GameDate): string {
    return WEEKDAYS[getDayOfWeek(date)];
}

/**
 * Get the month name for a date
 */
export function getMonthName(date: GameDate): string {
    return MONTHS[date.monthIndex].name;
}

/**
 * Format a date as a readable string
 * e.g., "12 Pflugzeit, 2512" or "Marktag, 12 Pflugzeit, 2512"
 */
export function formatDate(date: GameDate, includeWeekday: boolean = false): string {
    const monthName = getMonthName(date);

    if (includeWeekday) {
        const weekday = getWeekdayName(date);
        return `${weekday}, ${date.day} ${monthName}, ${date.year}`;
    }

    return `${date.day} ${monthName}, ${date.year}`;
}

/**
 * Get the season for a given month
 */
export function getSeason(monthIndex: number): Season {
    if ((SEASONS.WINTER as readonly number[]).includes(monthIndex)) return 'WINTER';
    if ((SEASONS.SPRING as readonly number[]).includes(monthIndex)) return 'SPRING';
    if ((SEASONS.SUMMER as readonly number[]).includes(monthIndex)) return 'SUMMER';
    return 'AUTUMN';
}

/**
 * Calculate the number of days between two dates
 */
export function daysBetween(from: GameDate, to: GameDate): number {
    const comparison = compareDates(from, to);
    if (comparison === 0) return 0;

    const isNegative = comparison === 1;
    const [earlier, later] = isNegative ? [to, from] : [from, to];

    let days = 0;
    let current = { ...earlier };

    // Count full years
    while (current.year < later.year - 1) {
        days += DAYS_IN_YEAR;
        current.year++;
    }

    // Count remaining days
    while (compareDates(current, later) === -1) {
        days++;
        current = addDays(current, 1);
    }

    return isNegative ? -days : days;
}

/**
 * Get the start of the current week
 */
export function getWeekStart(date: GameDate): GameDate {
    const dayOfWeek = getDayOfWeek(date);
    return subtractDays(date, dayOfWeek);
}

/**
 * Get all days in a month for calendar grid display
 * Returns an array of GameDate objects
 */
export function getMonthDays(year: number, monthIndex: number): GameDate[] {
    const daysInMonth = MONTHS[monthIndex].days;
    const days: GameDate[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
        days.push({ year, monthIndex, day });
    }

    return days;
}

/**
 * Get week rows for a month (for calendar grid)
 * Each row is an array of 8 days (or null for empty cells)
 */
export function getMonthWeeks(year: number, monthIndex: number): (GameDate | null)[][] {
    const firstDay: GameDate = { year, monthIndex, day: 1 };
    const startOffset = getDayOfWeek(firstDay);
    const daysInMonth = MONTHS[monthIndex].days;

    const weeks: (GameDate | null)[][] = [];
    let currentWeek: (GameDate | null)[] = [];

    // Add empty cells for days before the 1st
    for (let i = 0; i < startOffset; i++) {
        currentWeek.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        currentWeek.push({ year, monthIndex, day });

        if (currentWeek.length === 8) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }

    // Fill remaining cells in the last week
    if (currentWeek.length > 0) {
        while (currentWeek.length < 8) {
            currentWeek.push(null);
        }
        weeks.push(currentWeek);
    }

    return weeks;
}

// ========================================
// Moon Phase Calculations
// ========================================

/**
 * Calculate Mannslieb (the reliable white moon) phase
 * Cycle: ~25 days
 * @returns Phase percentage (0-100, where 100 = full moon)
 */
export function getMannsliebPhase(date: GameDate): number {
    const CYCLE_LENGTH = 25;

    // Calculate total days from year 0
    let totalDays = date.year * DAYS_IN_YEAR;
    for (let i = 0; i < date.monthIndex; i++) {
        totalDays += MONTHS[i].days;
    }
    totalDays += date.day;

    const dayInCycle = totalDays % CYCLE_LENGTH;
    const halfCycle = CYCLE_LENGTH / 2;

    // Calculate phase as percentage
    if (dayInCycle <= halfCycle) {
        return Math.round((dayInCycle / halfCycle) * 100);
    } else {
        return Math.round(((CYCLE_LENGTH - dayInCycle) / halfCycle) * 100);
    }
}

/**
 * Calculate Morrslieb (the erratic green moon) phase
 * Cycle: Chaotic, roughly ~44 days but with random variations
 * @returns Phase percentage (0-100, where 100 = full moon)
 */
export function getMorrsliebPhase(date: GameDate): number {
    const BASE_CYCLE = 44;

    // Calculate total days from year 0
    let totalDays = date.year * DAYS_IN_YEAR;
    for (let i = 0; i < date.monthIndex; i++) {
        totalDays += MONTHS[i].days;
    }
    totalDays += date.day;

    // Use a pseudo-random offset based on the date to make it erratic
    const seed = (totalDays * 7919) % 100; // Prime number for variation
    const cycleVariation = (seed % 11) - 5; // -5 to +5 day variation
    const effectiveCycle = BASE_CYCLE + cycleVariation;

    const dayInCycle = totalDays % effectiveCycle;
    const halfCycle = effectiveCycle / 2;

    if (dayInCycle <= halfCycle) {
        return Math.round((dayInCycle / halfCycle) * 100);
    } else {
        return Math.round(((effectiveCycle - dayInCycle) / halfCycle) * 100);
    }
}

/**
 * Get moon phase description
 */
export function getMoonPhaseDescription(percentage: number): string {
    if (percentage >= 95) return 'Full';
    if (percentage >= 75) return 'Waxing Gibbous';
    if (percentage >= 50) return 'Half';
    if (percentage >= 25) return 'Waxing Crescent';
    if (percentage >= 5) return 'Crescent';
    return 'New';
}

/**
 * Check if Morrslieb is in a dangerous phase (full or near-full)
 */
export function isMorrsliebDangerous(date: GameDate): boolean {
    return getMorrsliebPhase(date) >= 90;
}

// ========================================
// Weather Generation
// ========================================

const WEATHER_TABLE: Record<Season, string[]> = {
    WINTER: [
        'Heavy Snow',
        'Light Snow',
        'Freezing Rain',
        'Bitter Cold',
        'Overcast',
        'Cold & Clear',
        'Blizzard',
        'Frost',
        'Icy Winds',
        'Grey Skies'
    ],
    SPRING: [
        'Light Rain',
        'Heavy Rain',
        'Thunderstorm',
        'Overcast',
        'Partly Cloudy',
        'Clear Skies',
        'Drizzle',
        'Warm & Humid',
        'Cool Breeze',
        'Morning Fog'
    ],
    SUMMER: [
        'Hot & Clear',
        'Humid',
        'Afternoon Storm',
        'Warm & Sunny',
        'Light Breeze',
        'Scorching Heat',
        'Partly Cloudy',
        'Evening Thunder',
        'Pleasant',
        'Hazy'
    ],
    AUTUMN: [
        'Light Rain',
        'Heavy Rain',
        'Overcast',
        'Cool & Clear',
        'Fog',
        'Gusty Winds',
        'Drizzle',
        'Chilly',
        'Misty',
        'Grey Skies'
    ]
};

/**
 * Generate random weather for a given season
 */
export function generateWeather(season: Season): string {
    const weatherOptions = WEATHER_TABLE[season];
    const randomIndex = Math.floor(Math.random() * weatherOptions.length);
    return weatherOptions[randomIndex];
}

/**
 * Generate weather for a specific date
 */
export function generateWeatherForDate(date: GameDate): string {
    const season = getSeason(date.monthIndex);
    return generateWeather(season);
}

// ========================================
// Event Utilities
// ========================================

/**
 * Get events for a specific date
 */
export function getEventsForDate(events: TimelineEvent[], date: GameDate): TimelineEvent[] {
    return events.filter(event => datesEqual(event.date, date));
}

/**
 * Get upcoming events from a date, sorted by date
 */
export function getUpcomingEvents(
    events: TimelineEvent[],
    fromDate: GameDate,
    limit: number = 10,
    includeTags?: string[]
): TimelineEvent[] {
    let filtered = events.filter(event =>
        compareDates(event.date, fromDate) >= 0 // Event is on or after fromDate
    );

    // Filter by tags if provided
    if (includeTags && includeTags.length > 0) {
        filtered = filtered.filter(event =>
            event.tags.some(tag => includeTags.includes(tag))
        );
    }

    // Sort by date
    filtered.sort((a, b) => compareDates(a.date, b.date));

    // Limit results
    return filtered.slice(0, limit);
}

/**
 * Get events for a specific month
 */
export function getEventsForMonth(
    events: TimelineEvent[],
    year: number,
    monthIndex: number
): TimelineEvent[] {
    return events.filter(event =>
        event.date.year === year && event.date.monthIndex === monthIndex
    );
}

/**
 * Create a default calendar state
 */
export function createDefaultCalendarState(): CalendarState {
    return {
        currentDate: { year: 2512, monthIndex: 2, day: 1 }, // 1 Pflugzeit, 2512
        events: [],
        eventTags: ['Plot', 'World', 'Hidden', 'Festival', 'Personal'],
        currentWeather: undefined
    };
}

/**
 * Default event tags with colors
 */
export const DEFAULT_EVENT_TAGS: Record<string, string> = {
    'Plot': '#e63946',      // Red - Main story events
    'World': '#457b9d',     // Blue - World events
    'Hidden': '#6c757d',    // Gray - Secret/hidden events
    'Festival': '#f4a261',  // Orange - Festivals and holidays
    'Personal': '#2a9d8f'   // Teal - Personal character events
};

/**
 * Imperial Holidays (can be expanded)
 */
export const IMPERIAL_HOLIDAYS: TimelineEvent[] = [
    {
        id: 'hexentag',
        date: { year: 0, monthIndex: 0, day: 1 },
        title: 'Hexentag',
        description: 'Day of the Witch - A day of ill omen marking the start of the new year.',
        tags: ['Festival'],
        color: DEFAULT_EVENT_TAGS['Festival']
    },
    {
        id: 'mitterfruhl',
        date: { year: 0, monthIndex: 2, day: 1 },
        title: 'Mitterfruhl',
        description: 'Spring Equinox celebration.',
        tags: ['Festival'],
        color: DEFAULT_EVENT_TAGS['Festival']
    },
    {
        id: 'sigmarsfest',
        date: { year: 0, monthIndex: 3, day: 18 },
        title: 'Sigmarsfest',
        description: 'The most important festival in Sigmar\'s worship.',
        tags: ['Festival'],
        color: DEFAULT_EVENT_TAGS['Festival']
    },
    {
        id: 'sonnstill',
        date: { year: 0, monthIndex: 5, day: 33 },
        title: 'Sonnstill',
        description: 'Summer Solstice - The longest day of the year.',
        tags: ['Festival'],
        color: DEFAULT_EVENT_TAGS['Festival']
    },
    {
        id: 'geheimnistag',
        date: { year: 0, monthIndex: 6, day: 1 },
        title: 'Geheimnistag',
        description: 'Day of Mystery - A time when the veil between worlds is thin.',
        tags: ['Festival'],
        color: DEFAULT_EVENT_TAGS['Festival']
    },
    {
        id: 'mittherbst',
        date: { year: 0, monthIndex: 7, day: 1 },
        title: 'Mittherbst',
        description: 'Autumn Equinox celebration.',
        tags: ['Festival'],
        color: DEFAULT_EVENT_TAGS['Festival']
    },
    {
        id: 'mondstille',
        date: { year: 0, monthIndex: 10, day: 33 },
        title: 'Mondstille',
        description: 'Winter Solstice - The longest night of the year.',
        tags: ['Festival'],
        color: DEFAULT_EVENT_TAGS['Festival']
    },
    {
        id: 'monstille',
        date: { year: 0, monthIndex: 11, day: 32 },
        title: 'Monstille',
        description: 'Year\'s end - The last day of the year, a time for reflection.',
        tags: ['Festival'],
        color: DEFAULT_EVENT_TAGS['Festival']
    }
];
