# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **WFRP4e (Warhammer Fantasy Roleplay 4th Edition)** tabletop RPG application suite. It consists of two legacy Electron apps (GM and Player) plus a new web-based Player app, all backed by **Supabase** for persistence and real-time communication.

**Active migration:** The project is migrating from local JSON persistence + Socket.io LAN communication to a Supabase-backed architecture. The new `player-web` package is the primary focus of new development.

**Technology Stack:**
- Electron 33.4.11 + React 18.3.1 + TypeScript 5.4.2
- Vite 7.1.11 (build tool)
- **Supabase** (PostgreSQL + Realtime + Auth) — primary backend for player-web
- Socket.io 4.8.1 — legacy real-time, still used by gm-app and player-app
- Tailwind CSS 3.4.15 (styling)
- React Router v7 (player-web routing)
- i18next (EN/FR localisation across all apps)
- Vitest 2.1.5 + Playwright 1.48.2 (testing)

## Monorepo Structure

This is an npm workspaces monorepo with four packages:

- **`packages/gm-app`**: Game Master Electron desktop app (legacy, not yet migrated to Supabase)
- **`packages/player-app`**: Player Electron desktop app (legacy, not yet migrated)
- **`packages/player-web`**: Player web SPA — new Supabase-native app, primary active development
- **`packages/shared`**: Shared types, utilities, services, components, and game data

## Common Commands

### Development
```bash
# Install all dependencies
npm run install:all

# Run GM app in development mode (Electron)
npm run dev:gm

# Run legacy player app in development mode (Electron)
npm run dev:player

# Run new player web app in development mode (browser SPA)
npm run dev:player-web

# Build shared package (required before production builds)
npm run build:shared
```

### Building & Testing
```bash
# Build GM app for production (creates installer)
npm run build:gm

# Build player app for production
npm run build:player

# Run tests (run from specific package directory)
cd packages/gm-app && npm test
cd packages/player-app && npm test
cd packages/shared && npm test

# Or from root using workspace flag
npm run test -w @wfrp/gm-app
```

### Supabase
```bash
# Apply migrations to local Supabase instance
supabase db push

# Generate TypeScript types from schema
supabase gen types typescript --local > packages/shared/src/types/database.types.ts

# Migrate legacy campaign JSON to Supabase
npx tsx scripts/migrate-to-supabase.ts
```

## Architecture

### Package Comparison

| Aspect | gm-app | player-app | player-web |
|--------|--------|------------|------------|
| Runtime | Electron | Electron | Browser |
| Real-time | IPC + Socket.io server | Socket.io client | Supabase Realtime + Broadcast |
| Persistence | JSON files via IPC | Local state | Supabase PostgreSQL |
| Auth | Simple password | Simple password | Supabase Auth (email/password) |
| Status | Legacy — not yet migrated | Legacy — not yet migrated | Active development |

### GM App Architecture (Electron — Legacy)

```
Electron Main Process
├── Socket.io Server (port 3003) — manages player connections
├── Data Manager — persists campaign state to JSON
└── IPC Bridge — connects main process to React renderer

React Renderer (GM UI)
├── 14 domain context providers (CharacterContext, CombatContext, etc.)
├── Communicates with main process via window.ipcRenderer
├── GmCampaignRealtimeContext — partial Supabase realtime integration
└── Broadcasts updates to connected players via Socket.io
```

### Player App Architecture (Electron — Legacy)

```
Electron App
└── React Renderer
    ├── useSocket hook — manages Socket.io client connection
    ├── Connects to GM's server (ws://[ip]:3003)
    └── Sends actions, receives state updates
```

### Player Web Architecture (Browser SPA — New)

```
React SPA (player-web)
├── AuthContext — Supabase session management
├── PlayerSessionContext — active campaign state
├── PlayerNavigationContext — screen routing state
├── PlayerModalContext — modal management
└── Routes
    ├── /login           → LoginScreen
    ├── /campaigns       → CampaignListScreen
    └── /play/:id        → PlayerCampaignHome

@wfrp/shared service layer
├── lib/supabase.ts      — typed Supabase client (singleton)
├── lib/auth.ts          — auth helpers
├── lib/realtime.ts      — typed table subscriptions
├── lib/broadcast.ts     — ephemeral event channels
├── services/            — one service per domain entity
└── hooks/useRealtimeSync.ts, useBroadcast.ts, usePresence.ts
```

### Supabase Real-time Layers

Two distinct mechanisms in `packages/shared/src/lib/`:

1. **Table subscriptions** (`realtime.ts`) — Postgres CDC triggers on row changes. Used for persistent state: characters, journal, quests, map, combat, shop, factions, campaigns.
2. **Broadcast** (`broadcast.ts`) — ephemeral channel events, not persisted. Used for: skill test requests/results, opposed tests, GM↔player relay messages, pings. One channel per campaign (`campaign:{id}`).

### Legacy Communication Paths (gm-app / player-app only)

1. **Player → GM**: `socket.emit('player-message', msg)` → GM server → IPC → GM window
2. **GM → Player**: GM window → IPC → GM server → `socket.emit('gm-message', msg)` → Player
3. **Persistence**: GM state change → `ipcRenderer.saveData(campaignState)` → Main process → JSON file

### Core Data Structures

Located in `packages/shared/src/types/wfrp.types.ts`:

- **`Character`**: Player/NPC with characteristics, skills, talents, inventory, conditions
- **`User`**: Login credentials and character assignment
- **`CampaignState`**: Full campaign (characters, users, journal, map states) — legacy container
- **`Combatant`**: Combat tracker entry with initiative, wounds, conditions
- **`JournalEntry`**: GM notes shared with players
- **`MapPinState`**: Location discovery tracking

Auto-generated Supabase schema types live in `packages/shared/src/types/database.types.ts` — do not edit manually.

### Message Types

Defined in `packages/shared/src/types/messaging.types.ts`. These still describe the Socket.io message contracts used by gm-app and player-app. They are also reused as broadcast payloads in the Supabase migration for backwards compatibility.

**Client → Server (Socket.io / Broadcast):**
- `LOGIN_REQUEST`, `LOGOUT`
- `TEST_RESULT` — skill/characteristic test results
- `CHARACTER_UPDATE` — character advancement/changes
- `REQUEST_PURCHASE` — shop item requests
- `OPPOSED_TEST_RESULT` — combat roll results

**Server → Client (Socket.io / Broadcast):**
- `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `ASSIGN_CHARACTER`
- `UPDATE_INITIATIVE_TRACKER` — combat state sync
- `REQUEST_OPPOSED_TEST` — initiate combat roll
- `JOURNAL_UPDATE`, `MAP_STATE_UPDATE`
- `UPDATE_SHOP_INVENTORY`
- `PURCHASE_RESPONSE` — approve/deny purchases

### Data Persistence

**Legacy (gm-app):** campaign-state.json
- Windows: `AppData/Roaming/<app-name>/campaign-state.json`
- Mac: `~/Library/Application Support/<app-name>/campaign-state.json`

**New (player-web):** Supabase PostgreSQL
- Schema defined in `supabase/migrations/`
- Row-level security (RLS) enforces campaign membership
- Campaign join codes for player onboarding (`supabase/migrations/20250509120000_campaign_join_code.sql`)

### Service Layer (`packages/shared/src/services/`)

The service layer abstracts all Supabase data access. Each file handles one domain:

- `baseService.ts` — generic CRUD helpers (`getById`, `getAll`, `insert`, `update`, `remove`, `campaignQuery`)
- `campaignService.ts` — campaigns, members, join codes
- `characterService.ts`, `combatService.ts`, `shopService.ts`, `journalService.ts`
- `mapService.ts`, `mapInteractionService.ts` — map pins and tokens
- `questService.ts`, `factionService.ts`, `calendarService.ts`, `chatService.ts`
- `templateService.ts` — character templates
- `campaignBackupExport.ts` — export campaigns to JSON

### Game Mechanics

Core game logic in `packages/shared/src/utils/`:

- **`mechanics.ts`**: Dice rolling (`rolld100()`, `rollDice()`), success level calculation, hit locations
- **`talents.ts`**: Talent effects, bonuses, and applicability checks
- **`advancement.ts`**: XP costs for characteristics, skills, talents (WFRP4e progression rules)
- **`generator.ts`**: Random NPC/character generation
- **`skills.ts`**: Skill lookups and calculations
- **`inventory.ts`**: Item management utilities
- **`career.ts`**, **`conditions.ts`**, **`reputation.ts`**: Additional game systems
- **`diceParser.ts`**: Dice expression parser

**Talent System:**
- Talents stored in `packages/shared/src/data/talents.json`
- Effect types: `SL_BONUS_ON_SUCCESS`, `WOUNDS_BONUS`, `TEST_BONUS`, `DAMAGE_BONUS`, etc.
- Talent ranks can be numeric or formula-based (e.g., "TB" for Toughness Bonus)

**Combat System:**
- Initiative = Agility + d10
- Combatants track: initiative order, current/max wounds, conditions
- Opposed tests: attacker vs defender, winner gains advantage
- Critical hits/fumbles on specific roll ranges

### Shared Components

Located in `packages/shared/src/components/`:

- **`CharacterSheet.tsx`**: Full character sheet (editable in GM app, readonly + advancement mode in player app)
- **`PlayerCharacterSheet/`**: Character sheet variant for player-web
- **`MapDisplay.tsx`**: Campaign world map with location pins
- **`InventoryView.tsx`**: Weapons, armor, items display
- **`GameLog.tsx`**: Message log for tests/events
- **`CriticalHitModal.tsx`**, **`FumbleModal.tsx`**: Combat result modals
- **`CharacterCreationWizard.tsx`**: Step-by-step character creator
- **`calendar/`**: PlayerCalendarGrid, DateWeatherWidget
- **`codex/`**: CodexViewer, CommandPalette, rules browser
- **`chat/`**: ChatBox, MessageItem

These components are imported by all apps (gm-app, player-app, player-web).

## Important Development Patterns

### Supabase Client (player-web / new code)

Always use the typed client from shared:

```typescript
import { createSupabaseClient } from '@wfrp/shared';
const supabase = createSupabaseClient();
```

For auth state in player-web, consume `AuthContext`:
```typescript
const { session, user, signIn, signOut } = useAuth();
```

For real-time subscriptions, use the shared hooks:
```typescript
// Table change subscriptions
const { data } = useRealtimeSync(campaignId, 'characters');

// Ephemeral events (test requests, pings, etc.)
const { broadcast, listen } = useBroadcast(campaignId);

// Online presence
const { members } = usePresence(campaignId);
```

### Service Layer Usage (new code)

Import services from shared, pass the supabase client:
```typescript
import { characterService } from '@wfrp/shared';

const characters = await characterService.getAllForCampaign(supabase, campaignId);
await characterService.update(supabase, characterId, { wounds: 5 });
```

### IPC Communication (GM App Only — Legacy)

The GM app exposes IPC methods via preload script (`packages/gm-app/electron/preload/index.ts`):

```typescript
window.ipcRenderer.getInitialData()           // Load campaign from disk
window.ipcRenderer.saveData(data)             // Save campaign
window.ipcRenderer.getServerStatus()          // Socket.io server info
window.ipcRenderer.sendToPlayer(userId, msg)  // Send to specific player
window.ipcRenderer.sendToAllPlayers(msg)      // Broadcast to all players
window.ipcRenderer.onPlayerMessageReceived(cb)// Listen for player messages
```

Not applicable to player-web.

### Socket.io Client (Player App — Legacy)

Use the `useSocket` hook (`packages/player-app/src/hooks/useSocket.ts`):

```typescript
const { socket, isConnected, isAuthenticated, character, connect, sendMessage } = useSocket();
connect(ipAddress, username, password);
sendMessage({ type: 'TEST_RESULT', payload: { ... } });
```

Not applicable to player-web.

### State Management

**gm-app:** 14 React context providers split by domain (CharacterContext, CombatContext, etc.). `App.tsx` composes them all.

**player-app:** Socket state managed by `useSocket` hook, character state passed down from `App.tsx`.

**player-web:** 4 context providers (Auth, Session, Navigation, Modal) + Supabase realtime hooks. No prop drilling.

### Shared Package Workflow

When modifying `packages/shared/`:

1. Make changes to types/utils/components/services
2. Export from `packages/shared/src/index.ts`
3. Run `npm run build:shared` to compile TypeScript
4. Changes immediately available to all apps in dev mode (Vite path aliases)

**Note:** In development mode, Vite resolves `@wfrp/shared` directly to source files. Production builds require `npm run build:shared` first.

### TypeScript Strict Mode

All packages use strict TypeScript. Maintain type safety when:
- Adding new Supabase tables (regenerate `database.types.ts`)
- Adding new message/broadcast types (update `messaging.types.ts`)
- Modifying character structure (update `wfrp.types.ts` and service layer)
- Adding game mechanics (type all function signatures)

## Key Files Reference

**Supabase / new architecture:**
- `packages/shared/src/lib/supabase.ts` — typed Supabase client factory
- `packages/shared/src/lib/auth.ts` — auth helpers (signUp, signIn, signOut, getSession)
- `packages/shared/src/lib/realtime.ts` — typed table subscriptions per domain
- `packages/shared/src/lib/broadcast.ts` — ephemeral event channels
- `packages/shared/src/services/` — data access layer (one file per domain)
- `packages/shared/src/types/database.types.ts` — auto-generated Supabase schema types
- `supabase/migrations/` — SQL migrations
- `packages/player-web/src/context/AuthContext.tsx` — Supabase auth provider
- `packages/player-web/src/context/PlayerSessionContext.tsx` — campaign session state

**Must understand first:**
- `packages/shared/src/index.ts` — all shared exports
- `packages/shared/src/types/wfrp.types.ts` — core game domain models
- `packages/shared/src/types/messaging.types.ts` — message contracts (Socket.io + broadcast)
- `packages/gm-app/src/App.tsx` — GM orchestration logic
- `packages/player-web/src/App.tsx` — player-web routing and provider tree

**Legacy (gm-app / player-app):**
- `packages/player-app/src/hooks/useSocket.ts` — Socket.io client management
- `packages/gm-app/electron/main/server.ts` — Socket.io server
- `packages/gm-app/electron/main/dataManager.ts` — JSON persistence

**Game mechanics:**
- `packages/shared/src/utils/mechanics.ts` — dice, success levels, hit locations
- `packages/shared/src/utils/talents.ts` — talent effects and calculations
- `packages/shared/src/utils/advancement.ts` — XP cost formulas

**Game data (JSON):**
- `packages/shared/src/data/talents.json` — talent definitions
- `packages/shared/src/data/ubersreik.json` — campaign world locations
- `packages/shared/src/data/weapons.json`, `armor.json`, `items.json` — equipment
- `packages/shared/src/data/critical_hits.json`, `fumbles.json` — combat tables
- `packages/shared/src/data/codex/` — rules reference markdown files

## Electron + Vite Structure (gm-app / player-app)

**Development Mode:**
1. Vite dev server runs on port 5173 (React hot reload)
2. Electron main process compiles to `dist-electron/main/`
3. Electron loads `http://localhost:5173`

**Production Build:**
1. TypeScript compilation: `tsc`
2. Vite builds React to `dist/`
3. Electron builder packages to installer in `release/`

## Testing

- **Unit tests:** Vitest (run with `npm test` in package directory)
- **E2E tests:** Playwright (configured in gm-app and player-app)

When adding tests:
- gm-app: Test IPC communication, state management, server logic
- player-app: Test socket connection, message handling, UI flows
- player-web: Test Supabase auth flows, realtime subscriptions, screen navigation
- shared: Test game mechanics, XP calculations, talent effects, service layer

## Security

**Legacy (gm-app / player-app):**
- Socket.io server has CORS enabled for all origins
- Password hashing uses simple client-side algorithm

**New (Supabase):**
- Row-level security (RLS) enforced on all tables — campaign members can only access their own campaign data
- Supabase Auth handles password hashing (bcrypt)
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) must never be exposed client-side — only for server-side migrations

## Common Workflows

### Adding a New Supabase-Backed Feature

1. Add migration in `supabase/migrations/`
2. Regenerate types: `supabase gen types typescript --local > packages/shared/src/types/database.types.ts`
3. Add or update service in `packages/shared/src/services/`
4. Export from `packages/shared/src/index.ts`
5. Add realtime subscription in `packages/shared/src/lib/realtime.ts` if needed
6. Use in player-web via service + hook

### Adding a New Character Field

1. Update `Character` type in `packages/shared/src/types/wfrp.types.ts`
2. Update `CharacterSheet.tsx` to display/edit the field
3. Update `createBlankCharacter()` in `packages/shared/src/utils/generator.ts`
4. Add Supabase migration if field needs database persistence
5. Update character service if needed

### Adding a New Game Mechanic

1. Add utility function to `packages/shared/src/utils/mechanics.ts` (or relevant file)
2. Export from `packages/shared/src/index.ts`
3. Use in app components
4. Add Vitest tests for complex logic

### Adding a New Talent

1. Add to `packages/shared/src/data/talents.json`:
   ```json
   {
     "id": "new-talent-id",
     "name": "Talent Name",
     "description": "...",
     "max_ranks": 1,
     "tests": ["Skill Name"],
     "effects": [{ "type": "SL_BONUS_ON_SUCCESS", "value": 1 }]
   }
   ```
2. If new effect type needed, update `packages/shared/src/utils/talents.ts`

### Adding a Broadcast Event (player-web real-time)

1. Add event type to `EphemeralEventType` enum in `packages/shared/src/lib/broadcast.ts`
2. Define payload shape in `messaging.types.ts`
3. Add send/listen helpers in `broadcast.ts`
4. Use `useBroadcast` hook in component

## Package Inter-dependencies

```
gm-app
├── depends on: @wfrp/shared
└── direct import: ../shared/src/index.ts (via Vite alias)

player-app
├── depends on: @wfrp/shared
└── direct import: ../shared/src/index.ts (via Vite alias)

player-web
├── depends on: @wfrp/shared
└── direct import: ../shared/src/index.ts (via Vite alias)

shared
├── @supabase/supabase-js (primary backend)
├── socket.io / socket.io-client (legacy — still present)
└── no dependencies on other workspace packages
```

**Important:** Changes to shared are immediately reflected in dev mode due to Vite path aliases. Production builds require `npm run build:shared` first.
