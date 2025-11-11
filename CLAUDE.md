# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **WFRP4e (Warhammer Fantasy Roleplay 4th Edition)** tabletop RPG desktop application suite. It consists of two Electron apps (GM and Player) that communicate in real-time via Socket.io, allowing a game master to run sessions with remote players.

**Technology Stack:**
- Electron 33.4.11 + React 18.3.1 + TypeScript 5.4.2
- Vite 7.1.11 (build tool)
- Socket.io 4.8.1 (real-time communication)
- Tailwind CSS 3.4.15 (styling)
- Vitest 2.1.5 + Playwright 1.48.2 (testing)

## Monorepo Structure

This is an npm workspaces monorepo with three packages:

- **`packages/gm-app`**: Game Master desktop application
- **`packages/player-app`**: Player desktop application
- **`packages/shared`**: Shared types, utilities, components, and game data

## Common Commands

### Development
```bash
# Install all dependencies
npm run install:all

# Run GM app in development mode
npm run dev:gm

# Run player app in development mode
npm run dev:player

# Build shared package (required if modifying shared/)
npm run build:shared
```

### Building & Testing
```bash
# Build GM app for production (creates installer)
npm run build:gm

# Build player app for production
npm run build:player

# Run tests (run from specific package directory)
cd packages/gm-app
npm test

cd packages/player-app
npm test
```

### Running tests in specific packages
```bash
# Navigate to package and run tests
cd packages/gm-app
npm run test

# Or run from root using workspace flag
npm run test -w @wfrp/gm-app
```

## Architecture

### Communication Flow

**GM App Architecture:**
```
Electron Main Process
├── Socket.io Server (port 3003) - manages player connections
├── Data Manager - persists campaign state to JSON
└── IPC Bridge - connects main process to React renderer

React Renderer (GM UI)
├── Manages campaign state (characters, users, journal, map)
├── Communicates with main process via window.ipcRenderer
└── Broadcasts updates to connected players
```

**Player App Architecture:**
```
Electron App
└── React Renderer
    ├── useSocket hook - manages Socket.io client connection
    ├── Connects to GM's server (ws://[ip]:3003)
    └── Sends actions, receives state updates
```

**Key Communication Paths:**
1. **Player → GM**: `socket.emit('player-message', msg)` → GM server → IPC → GM window
2. **GM → Player**: GM window → IPC → GM server → `socket.emit('gm-message', msg)` → Player
3. **Persistence**: GM state change → `ipcRenderer.saveData()` → Main process → JSON file

### Core Data Structures

Located in `packages/shared/src/types/wfrp.types.ts`:

- **`Character`**: Player/NPC with characteristics, skills, talents, inventory, conditions
- **`User`**: Login credentials and character assignment
- **`CampaignState`**: Full campaign (characters, users, journal, map states)
- **`Combatant`**: Combat tracker entry with initiative, wounds, conditions
- **`JournalEntry`**: GM notes shared with players
- **`MapPinState`**: Location discovery tracking

### Message Types

All Socket.io messages defined in `packages/shared/src/types/messaging.types.ts`.

**Client → Server:**
- `LOGIN_REQUEST`, `LOGOUT`
- `TEST_RESULT` - skill/characteristic test results
- `CHARACTER_UPDATE` - character advancement/changes
- `REQUEST_PURCHASE` - shop item requests
- `OPPOSED_TEST_RESULT` - combat roll results

**Server → Client:**
- `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `ASSIGN_CHARACTER`
- `UPDATE_INITIATIVE_TRACKER` - combat state sync
- `REQUEST_OPPOSED_TEST` - initiate combat roll
- `JOURNAL_UPDATE`, `MAP_STATE_UPDATE`
- `UPDATE_SHOP_INVENTORY`
- `PURCHASE_RESPONSE` - approve/deny purchases

### Data Persistence

Campaign data is stored in:
- Windows: `AppData/Roaming/<app-name>/campaign-state.json`
- Mac: `~/Library/Application Support/<app-name>/campaign-state.json`
- Linux: `~/.config/<app-name>/campaign-state.json`

**Persistence flow:**
1. GM makes change in UI
2. React state updates
3. `window.ipcRenderer.saveData(campaignState)` called
4. Main process writes to `campaign-state.json` via `dataManager.ts`
5. Changes broadcast to connected players via Socket.io

### Game Mechanics

Core game logic in `packages/shared/src/utils/`:

- **`mechanics.ts`**: Dice rolling (`rolld100()`, `rollDice()`), success level calculation, hit locations
- **`talents.ts`**: Talent effects, bonuses, and applicability checks
- **`advancement.ts`**: XP costs for characteristics, skills, talents (uses WFRP4e progression rules)
- **`generator.ts`**: Random NPC/character generation
- **`skills.ts`**: Skill lookups and calculations
- **`inventory.ts`**: Item management utilities

**Talent System:**
- Talents stored in `packages/shared/src/data/talents.json`
- Each talent has effects (SL bonuses, test bonuses, passive effects, etc.)
- Effect types: `SL_BONUS_ON_SUCCESS`, `WOUNDS_BONUS`, `TEST_BONUS`, `DAMAGE_BONUS`, etc.
- Talent ranks can be numeric or formula-based (e.g., "TB" for Toughness Bonus)

**Combat System:**
- Initiative = Agility + d10
- Combatants track: initiative order, current/max wounds, conditions
- Opposed tests: attacker vs defender, winner gains advantage
- Advantage: tracked per side (players vs enemies)
- Critical hits/fumbles on specific roll ranges

### Shared Components

Located in `packages/shared/src/components/`:

- **`CharacterSheet.tsx`**: Full character sheet (editable in GM app, readonly + advancement mode in player app)
- **`MapDisplay.tsx`**: Campaign world map with location pins
- **`InventoryView.tsx`**: Weapons, armor, items display
- **`GameLog.tsx`**: Message log for tests/events
- **`CriticalHitModal.tsx`**, **`FumbleModal.tsx`**: Combat result modals

These components are imported by both GM and player apps.

## Important Development Patterns

### IPC Communication (GM App Only)

The GM app exposes IPC methods via preload script (`packages/gm-app/electron/preload/index.ts`):

```typescript
window.ipcRenderer.getInitialData() // Load campaign from disk
window.ipcRenderer.saveData(data) // Save campaign
window.ipcRenderer.getServerStatus() // Socket.io server info
window.ipcRenderer.sendToPlayer(userId, message) // Send to specific player
window.ipcRenderer.sendToAllPlayers(message) // Broadcast
window.ipcRenderer.onPlayerMessageReceived(callback) // Listen for player messages
```

**Always use IPC for:**
- Loading/saving campaign data
- Sending messages to players
- Getting server status

### Socket.io Client (Player App)

Use the `useSocket` hook (`packages/player-app/src/hooks/useSocket.ts`):

```typescript
const {
  socket,
  isConnected,
  isAuthenticated,
  character,
  combatants,
  // ... other state
  connect,
  sendMessage,
  disconnect
} = useSocket();

// Connect to GM
connect(ipAddress, username, password);

// Send message
sendMessage({ type: 'TEST_RESULT', payload: { ... } });
```

### State Management

Both apps use React state at the top level (`App.tsx`). No Redux/Zustand.

**GM App:** All campaign state lives in `App.tsx`, passed down to components via props.

**Player App:** Socket state managed by `useSocket` hook, character state passed down from `App.tsx`.

### TypeScript Strict Mode

All packages use strict TypeScript:
```json
{
  "strict": true,
  "forceConsistentCasingInFileNames": true,
  "noEmit": true
}
```

Maintain type safety when:
- Adding new message types (update `messaging.types.ts`)
- Modifying character structure (update `wfrp.types.ts`)
- Adding game mechanics (type all function signatures)

### Shared Package Workflow

When modifying `packages/shared/`:

1. Make changes to types/utils/components
2. Export from `packages/shared/src/index.ts`
3. Run `npm run build:shared` to compile TypeScript
4. Changes immediately available to gm-app and player-app (via direct path alias in Vite config)

**Note:** In development mode, Vite resolves `@wfrp/shared` directly to source files, so you don't always need to rebuild. However, for production builds, run `build:shared` first.

## Key Files Reference

**Must understand first:**
- `packages/shared/src/index.ts` - All shared exports
- `packages/shared/src/types/wfrp.types.ts` - Core data model
- `packages/shared/src/types/messaging.types.ts` - Socket.io message contracts
- `packages/gm-app/src/App.tsx` - GM orchestration logic
- `packages/player-app/src/App.tsx` - Player orchestration logic
- `packages/player-app/src/hooks/useSocket.ts` - Socket.io client management
- `packages/gm-app/electron/main/server.ts` - Socket.io server
- `packages/gm-app/electron/main/dataManager.ts` - Campaign persistence

**Game mechanics:**
- `packages/shared/src/utils/mechanics.ts` - Dice, success levels, hit locations
- `packages/shared/src/utils/talents.ts` - Talent effects and calculations
- `packages/shared/src/utils/advancement.ts` - XP cost formulas

**Game data (JSON):**
- `packages/shared/src/data/talents.json` - Talent definitions
- `packages/shared/src/data/ubersreik.json` - Campaign world locations
- `packages/shared/src/data/weapons.json`, `armor.json`, `items.json` - Equipment
- `packages/shared/src/data/critical_hits.json`, `fumbles.json` - Combat tables

## Electron + Vite Structure

**Development Mode:**
1. Vite dev server runs on port 5173 (React hot reload)
2. Electron main process compiles to `dist-electron/main/`
3. Electron loads `http://localhost:5173`

**Production Build:**
1. TypeScript compilation: `tsc`
2. Vite builds React to `dist/`
3. Electron builder packages to installer in `release/`

**Build outputs:**
- `dist/` - React renderer build
- `dist-electron/` - Electron main + preload build
- `release/` - Final installers (.exe, .dmg, etc.)

## Testing

- **Unit tests:** Vitest (run with `npm test` in package directory)
- **E2E tests:** Playwright (configured in both apps)

When adding tests:
- GM app: Test IPC communication, state management, server logic
- Player app: Test socket connection, message handling, UI flows
- Shared: Test game mechanics, XP calculations, talent effects

## Security Notes

**Current implementation:**
- Socket.io server has CORS enabled for all origins
- Password hashing uses simple client-side algorithm (not bcrypt)
- No message signing/validation between processes
- IPC assumes trust between main and renderer

**When enhancing security:**
- Add proper password hashing (bcrypt) in `packages/gm-app/electron/main/server.ts`
- Implement CORS whitelist for Socket.io
- Add message validation/schema checks
- Consider TLS for Socket.io if deploying over internet

## Common Workflows

### Adding a New Message Type

1. Define in `packages/shared/src/types/messaging.types.ts`:
   ```typescript
   export type NewMessageType = {
     type: 'NEW_MESSAGE';
     payload: { ... };
   };
   ```
2. Add to union types: `ClientToServerMessage` or `ServerToClientMessage`
3. Handle in GM server: `packages/gm-app/electron/main/server.ts`
4. Handle in player client: `packages/player-app/src/hooks/useSocket.ts`

### Adding a New Character Field

1. Update `Character` type in `packages/shared/src/types/wfrp.types.ts`
2. Update `CharacterSheet.tsx` component to display/edit field
3. Update `createBlankCharacter()` in `packages/shared/src/utils/generator.ts` with default value
4. Update any relevant game mechanics in `packages/shared/src/utils/`

### Adding a New Game Mechanic

1. Add utility function to `packages/shared/src/utils/mechanics.ts` (or relevant file)
2. Export from `packages/shared/src/index.ts`
3. Use in GM/player app components
4. Add tests if complex logic

### Adding a New Talent

1. Add to `packages/shared/src/data/talents.json`:
   ```json
   {
     "id": "new-talent-id",
     "name": "Talent Name",
     "description": "...",
     "max_ranks": 1,
     "tests": ["Skill Name"],
     "effects": [
       { "type": "SL_BONUS_ON_SUCCESS", "value": 1 }
     ]
   }
   ```
2. If new effect type needed, update `packages/shared/src/utils/talents.ts`

## Package Inter-dependencies

```
gm-app
├── depends on: @wfrp/shared
└── direct import: ../shared/src/index.ts (via Vite alias)

player-app
├── depends on: @wfrp/shared
└── direct import: ../shared/src/index.ts (via Vite alias)

shared
└── no dependencies on other workspace packages
```

**Important:** Changes to shared package are immediately reflected in dev mode due to Vite path aliases. No need to rebuild for local development, but production builds require `npm run build:shared` first.
