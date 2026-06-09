# Fight Debug Export

Fight Lab exports are self-contained `*.fight.json` fixtures containing:

```json
{
  "config": {},
  "seed": "deterministic-seed",
  "index": 7,
  "expectedOutcome": {},
  "engineVersion": "1.0.1"
}
```

`config` contains the sandbox combatant snapshots, so the fixture does not depend on campaign or scenario storage. Failed fights use `{ "error": "..." }` as `expectedOutcome`.

## Workflow

1. In Fight Lab, open a replay and click **Export fight for debugging**, or export a representative outcome/failing seed from the dashboard.
2. Put the downloaded `*.fight.json` anywhere in the repository, conventionally under `packages/shared/test/combat/fixtures/`.
3. Run it synchronously on the main thread:

   ```powershell
   npm run debug:fight -w @wfrp/shared -- test/combat/fixtures/example.fight.json
   ```

4. For a debugger that pauses before engine execution:

   ```powershell
   node --inspect-brk --import tsx packages/shared/scripts/debug-fight.ts packages/shared/test/combat/fixtures/example.fight.json
   ```

Attach a JavaScript debugger and place breakpoints anywhere under `packages/shared/src`. The harness calls `runFight(config, seed)` directly, without Electron, React, or a worker.

The command exits with an error when the current result differs from `expectedOutcome`, making engine drift immediately visible. A fixture can also be committed and loaded from a normal Vitest regression test with `parseFightDebugFixture` and `runFightDebugFixture`.
