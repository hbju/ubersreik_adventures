import { useTranslation } from 'react-i18next'

const COLORS = [
  { label: 'bg-deepest', var: '--bg-deepest' },
  { label: 'bg-dark', var: '--bg-dark' },
  { label: 'bg-panel', var: '--bg-panel' },
  { label: 'bg-elevated', var: '--bg-elevated' },
  { label: 'bg-surface', var: '--bg-surface' },
  { label: 'parchment', var: '--parchment' },
  { label: 'parchment-dark', var: '--parchment-dark' },
  { label: 'parchment-light', var: '--parchment-light' },
  { label: 'brass', var: '--brass' },
  { label: 'brass-light', var: '--brass-light' },
  { label: 'brass-dark', var: '--brass-dark' },
  { label: 'iron', var: '--iron' },
  { label: 'iron-dark', var: '--iron-dark' },
  { label: 'copper', var: '--copper' },
  { label: 'copper-light', var: '--copper-light' },
  { label: 'blood', var: '--blood' },
  { label: 'blood-light', var: '--blood-light' },
  { label: 'poison', var: '--poison' },
  { label: 'poison-light', var: '--poison-light' },
  { label: 'magic', var: '--magic' },
  { label: 'magic-light', var: '--magic-light' },
  { label: 'fate', var: '--fate' },
  { label: 'fate-light', var: '--fate-light' },
  { label: 'status-success', var: '--status-success' },
  { label: 'status-danger', var: '--status-danger' },
  { label: 'status-warning', var: '--status-warning' },
  { label: 'status-info', var: '--status-info' },
  { label: 'text-primary', var: '--text-primary' },
  { label: 'text-secondary', var: '--text-secondary' },
  { label: 'text-accent', var: '--text-accent' },
  { label: 'text-muted', var: '--text-muted' },
  { label: 'border-dark', var: '--border-dark' },
  { label: 'border-subtle', var: '--border-subtle' },
  { label: 'border-brass-solid', var: '--border-brass-solid' },
]

function ColorSwatch({ label, cssVar }: { label: string; cssVar: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-sm border border-subtle shrink-0"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div>
        <p className="text-sm font-semibold text-primary mb-0">{label}</p>
        <p className="text-xs text-muted mb-0">{cssVar}</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="wfrp-text-heading text-2xl mb-4">{title}</h2>
      <hr className="wfrp-divider" />
      {children}
    </section>
  )
}

export function ThemeShowcase() {
  const { t } = useTranslation()

  return (
    <div className="wfrp-dark min-h-screen p-8 wfrp-grain-overlay">
      <div className="max-w-5xl mx-auto">
        <h1 className="wfrp-text-heading text-4xl mb-2">
          WFRP Design System
        </h1>
        <p className="text-secondary mb-8">
          Theme tokens, typography, and utility class reference. Dev-only — {t('auth.title')}.
        </p>

        <hr className="wfrp-divider-strong" />

        {/* ─── Colors ─── */}
        <Section title="Color Palette">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {COLORS.map((c) => (
              <ColorSwatch key={c.var} label={c.label} cssVar={c.var} />
            ))}
          </div>
        </Section>

        {/* ─── Typography ─── */}
        <Section title="Typography">
          <div className="wfrp-panel mb-6 space-y-4">
            <div>
              <p className="text-xs text-muted mb-1 uppercase tracking-wider">Display Font (--font-display)</p>
              <p className="font-display text-3xl text-accent">The Old World Beckons</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1 uppercase tracking-wider">Body Font (--font-body)</p>
              <p className="font-body text-lg text-primary leading-relaxed">
                The streets of Ubersreik are treacherous. Shadows cling to the cobblestones,
                and the scent of gunpowder mingles with the damp river air. Only the bold dare
                walk these paths after sundown.
              </p>
            </div>
          </div>

          <div className="wfrp-panel space-y-3">
            <p className="text-xs text-muted mb-2 uppercase tracking-wider">Type Scale</p>
            <p style={{ fontSize: 'var(--text-xs)' }} className="text-primary">text-xs (0.75rem) — Fine print and labels</p>
            <p style={{ fontSize: 'var(--text-sm)' }} className="text-primary">text-sm (0.875rem) — Secondary text</p>
            <p style={{ fontSize: 'var(--text-base)' }} className="text-primary">text-base (1rem) — Body text default</p>
            <p style={{ fontSize: 'var(--text-lg)' }} className="text-primary">text-lg (1.125rem) — Slightly emphasized</p>
            <p style={{ fontSize: 'var(--text-xl)' }} className="text-primary">text-xl (1.25rem) — Subheadings</p>
            <p style={{ fontSize: 'var(--text-2xl)' }} className="text-primary">text-2xl (1.5rem) — Section headings</p>
            <p style={{ fontSize: 'var(--text-3xl)' }} className="text-primary">text-3xl (1.875rem) — Page titles</p>
            <p style={{ fontSize: 'var(--text-4xl)' }} className="text-primary font-display">text-4xl (2.25rem) — Display</p>
          </div>
        </Section>

        {/* ─── Panels ─── */}
        <Section title="Panels">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="wfrp-panel">
              <p className="text-sm text-muted mb-1">.wfrp-panel</p>
              <p className="text-primary mb-0">Standard dark panel with inset shadow.</p>
            </div>
            <div className="wfrp-panel-elevated">
              <p className="text-sm text-muted mb-1">.wfrp-panel-elevated</p>
              <p className="text-primary mb-0">Elevated panel for dropdowns/popovers.</p>
            </div>
            <div className="wfrp-panel-parchment">
              <p className="text-sm text-muted mb-1">.wfrp-panel-parchment</p>
              <p className="mb-0">Light parchment panel for readable content.</p>
            </div>
          </div>
        </Section>

        {/* ─── Borders & Dividers ─── */}
        <Section title="Borders & Dividers">
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <div className="wfrp-border-ornate p-4 rounded-sm">
              <p className="text-primary text-sm mb-0">.wfrp-border-ornate — Double-layered brass border</p>
            </div>
            <div className="wfrp-border-subtle p-4 rounded-sm">
              <p className="text-primary text-sm mb-0">.wfrp-border-subtle — Minimal dark border</p>
            </div>
          </div>
          <div className="wfrp-panel">
            <p className="text-sm text-muted mb-2">.wfrp-divider</p>
            <hr className="wfrp-divider" />
            <p className="text-sm text-muted mb-2 mt-4">.wfrp-divider-strong</p>
            <hr className="wfrp-divider-strong" />
          </div>
        </Section>

        {/* ─── Shadows ─── */}
        <Section title="Shadows">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-md bg-bg-panel shadow-inset">
              <p className="text-sm text-primary mb-0">shadow-inset</p>
            </div>
            <div className="p-4 rounded-md bg-bg-panel shadow-elevated">
              <p className="text-sm text-primary mb-0">shadow-elevated</p>
            </div>
            <div className="p-4 rounded-md bg-bg-panel shadow-deep">
              <p className="text-sm text-primary mb-0">shadow-deep</p>
            </div>
            <div className="p-4 rounded-md bg-bg-panel shadow-glow-brass">
              <p className="text-sm text-primary mb-0">shadow-glow-brass</p>
            </div>
          </div>
        </Section>

        {/* ─── Grain Overlay ─── */}
        <Section title="Grain Overlay">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="wfrp-panel wfrp-grain-overlay h-32 flex items-center justify-center">
              <p className="text-primary text-sm mb-0">.wfrp-grain-overlay (look closely)</p>
            </div>
            <div className="wfrp-panel h-32 flex items-center justify-center">
              <p className="text-primary text-sm mb-0">Without grain (comparison)</p>
            </div>
          </div>
        </Section>

        {/* ─── Interactive Elements ─── */}
        <Section title="Interactive Elements">
          <div className="wfrp-panel space-y-6">
            <div>
              <p className="text-xs text-muted mb-2 uppercase tracking-wider">Buttons (inherited from base styles)</p>
              <div className="flex flex-wrap gap-3">
                <button type="button">Standard</button>
                <button type="button" disabled>Disabled</button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted mb-2 uppercase tracking-wider">Glow hover</p>
              <div className="flex gap-3">
                <div className="wfrp-glow-brass-hover border border-dark rounded-md px-4 py-2 cursor-pointer transition-all">
                  <span className="text-primary text-sm">Hover me for brass glow</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted mb-2 uppercase tracking-wider">Inputs</p>
              <div className="flex flex-wrap gap-3 max-w-md">
                <input
                  type="text"
                  placeholder="Text input"
                  className="w-full"
                  readOnly
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ─── Scrollbar ─── */}
        <Section title="Custom Scrollbar">
          <div className="wfrp-panel wfrp-scrollbar h-32 overflow-y-auto">
            {Array.from({ length: 20 }, (_, i) => (
              <p key={i} className="text-sm text-secondary py-1 mb-0">
                Scroll line {i + 1} — The Empire endures.
              </p>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
