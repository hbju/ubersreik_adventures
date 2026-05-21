import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlayerModalProvider, usePlayerModal } from '../../context/PlayerModalContext'
import { ModalHeader, ModalBody, ModalFooter } from '../modal/ModalParts'
import { PlayerModalHost } from '../layout/PlayerModalHost'
import { Button, Input, TextArea, Select, Tooltip, Badge, Tabs, Divider } from '../ui'

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
    <PlayerModalProvider>
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

        {/* ─── Custom Scrollbar ─── */}
        <Section title="Custom Scrollbar">
          <div className="wfrp-panel wfrp-scrollbar h-32 overflow-y-auto">
            {Array.from({ length: 20 }, (_, i) => (
              <p key={i} className="text-sm text-secondary py-1 mb-0">
                Scroll line {i + 1} — The Empire endures.
              </p>
            ))}
          </div>
        </Section>

        {/* ─── Modal Demos ─── */}
        <Section title="Modals">
          <ModalDemoButtons />
        </Section>

        {/* ─── Components ─── */}
        <Section title="Components">
          <ComponentShowcase />
        </Section>
      </div>
    </div>
    <PlayerModalHost />
    </PlayerModalProvider>
  )
}

function ModalDemoButtons() {
  const { openModal, closeModal } = usePlayerModal()

  const openConfirm = () => {
    openModal(
      'demo-confirm',
      <ConfirmDemo onClose={() => closeModal('demo-confirm')} />,
      { size: 'sm', dismissable: true }
    )
  }

  const openScrollable = () => {
    openModal(
      'demo-scrollable',
      <ScrollableDemo />,
      { size: 'lg', dismissable: true }
    )
  }

  const openSheet = () => {
    openModal(
      'demo-sheet',
      <SheetDemo />,
      { variant: 'sheet', dismissable: true }
    )
  }

  return (
    <div className="wfrp-panel">
      <p className="text-xs text-muted mb-3 uppercase tracking-wider">Demo Modals (dev-only)</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={openConfirm}>Confirmation Dialog</button>
        <button type="button" onClick={openScrollable}>Scrollable Content</button>
        <button type="button" onClick={openSheet}>Sheet (Mobile)</button>
      </div>
    </div>
  )
}

function ConfirmDemo({ onClose }: { onClose: () => void }) {
  return (
    <>
      <ModalHeader title="Confirm Action" subtitle="This action cannot be undone." />
      <ModalBody>
        <p className="text-secondary mb-0">
          Are you sure you want to spend <span className="text-accent font-bold">25 XP</span> to advance Weapon Skill?
        </p>
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="opacity-70">Cancel</button>
        <button type="button" onClick={onClose}>Confirm</button>
      </ModalFooter>
    </>
  )
}

function ScrollableDemo() {
  return (
    <>
      <ModalHeader title="Tome of Knowledge" subtitle="A lengthy scroll of ancient lore" />
      <ModalBody>
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i} className="text-secondary mb-3">
            <span className="text-accent font-display">Chapter {i + 1}:</span>{' '}
            The Empire stretches from the Grey Mountains in the west to the World&apos;s Edge Mountains in the east.
            Its provinces are bound by the will of the Emperor and the strength of its armies.
            Yet darkness lurks in every shadow, and chaos whispers at the gates.
          </p>
        ))}
      </ModalBody>
    </>
  )
}

function SheetDemo() {
  return (
    <>
      <ModalHeader title="Quick Actions" />
      <ModalBody>
        <div className="space-y-3">
          {['View Inventory', 'Check Skills', 'Roll Initiative', 'Rest & Recover'].map((action) => (
            <button key={action} type="button" className="w-full text-left">
              {action}
            </button>
          ))}
        </div>
      </ModalBody>
    </>
  )
}

function ComponentShowcase() {
  const [selectVal, setSelectVal] = useState('')
  const [textareaVal, setTextareaVal] = useState('')
  const [activeTab, setActiveTab] = useState('stats')

  return (
    <div className="space-y-8">
      {/* Buttons */}
      <div className="wfrp-panel space-y-4">
        <p className="text-xs text-muted mb-2 uppercase tracking-wider">Buttons</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
          <Button iconLeft={<SwordIcon />}>With Icon</Button>
        </div>
      </div>

      {/* Inputs */}
      <div className="wfrp-panel space-y-4 max-w-md">
        <p className="text-xs text-muted mb-2 uppercase tracking-wider">Inputs</p>
        <Input label="Character Name" placeholder="Enter name…" />
        <Input label="Wounds" placeholder="0" size="sm" helperText="Current wounds taken" />
        <Input label="Invalid Field" placeholder="Error shown" error="This field is required" />
        <Input label="Disabled" placeholder="Cannot edit" disabled />
      </div>

      {/* TextArea */}
      <div className="wfrp-panel space-y-4 max-w-md">
        <p className="text-xs text-muted mb-2 uppercase tracking-wider">TextArea</p>
        <TextArea
          label="Journal Entry"
          placeholder="Write your notes…"
          value={textareaVal}
          onChange={(e) => setTextareaVal(e.target.value)}
          maxLength={200}
          showCount
        />
        <TextArea label="Auto-grow" placeholder="This grows as you type…" autoGrow />
      </div>

      {/* Select */}
      <div className="wfrp-panel space-y-4 max-w-sm">
        <p className="text-xs text-muted mb-2 uppercase tracking-wider">Select</p>
        <Select
          label="Career"
          placeholder="Choose a career…"
          value={selectVal}
          onChange={setSelectVal}
          options={[
            { label: 'Warrior', options: [{ value: 'soldier', label: 'Soldier' }, { value: 'knight', label: 'Knight' }] },
            { label: 'Academic', options: [{ value: 'wizard', label: 'Wizard' }, { value: 'physician', label: 'Physician' }] },
            { value: 'rat-catcher', label: 'Rat Catcher' },
          ]}
        />
        <Select label="Disabled" placeholder="—" options={[]} disabled />
      </div>

      {/* Tooltip */}
      <div className="wfrp-panel">
        <p className="text-xs text-muted mb-3 uppercase tracking-wider">Tooltips</p>
        <div className="flex flex-wrap items-center gap-6">
          <Tooltip content="Attack bonus +10%">
            <Button variant="secondary" size="sm">Hover me (top)</Button>
          </Tooltip>
          <Tooltip content="Defensive stance active" position="bottom">
            <Button variant="ghost" size="sm">Bottom tooltip</Button>
          </Tooltip>
          <Tooltip content="Critical hit!" position="right">
            <Badge variant="danger">Crit</Badge>
          </Tooltip>
        </div>
      </div>

      {/* Badges */}
      <div className="wfrp-panel">
        <p className="text-xs text-muted mb-3 uppercase tracking-wider">Badges</p>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="magic">Magic</Badge>
          <Badge variant="info">Info</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Badge size="sm">Small</Badge>
          <Badge size="md" onDismiss={() => {}}>Dismissable</Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="wfrp-panel">
        <p className="text-xs text-muted mb-3 uppercase tracking-wider">Tabs</p>
        <Tabs
          tabs={[
            { id: 'stats', label: 'Statistics' },
            { id: 'skills', label: 'Skills' },
            { id: 'talents', label: 'Talents' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'notes', label: 'Notes' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <p className="text-sm text-secondary mt-3 mb-0">Active: {activeTab}</p>
      </div>

      {/* Dividers */}
      <div className="wfrp-panel space-y-4">
        <p className="text-xs text-muted mb-2 uppercase tracking-wider">Dividers</p>
        <Divider variant="subtle" />
        <Divider variant="ornate" />
        <Divider variant="section" label="Chapter II" />
        <div className="flex items-center gap-4 h-8">
          <span className="text-sm text-secondary">Left</span>
          <Divider variant="ornate" direction="vertical" />
          <span className="text-sm text-secondary">Right</span>
        </div>
      </div>
    </div>
  )
}

function SwordIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6" />
      <path d="M16 16l4 4" />
      <path d="M19 21l2-2" />
    </svg>
  )
}
