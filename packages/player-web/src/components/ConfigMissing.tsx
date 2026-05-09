export function ConfigMissing() {
  return (
    <div className="card parchment mx-auto max-w-lg w-full text-left">
      <h1 className="mb-4 text-center">Configuration required</h1>
      <p className="mb-4 text-[var(--color-ink-faded)]">
        Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
        <code>packages/player-web/.env</code> (see <code>.env.example</code>), then restart the dev server.
      </p>
    </div>
  )
}
