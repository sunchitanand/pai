# UI Production Polish — Scratchpad

## Iteration 1 — 2026-03-16

### Understanding
- Project root: `/Users/sunchit/Documents/projects/pai/`
- Target files: `packages/ui/src/pages/HomeBriefs.tsx`, `packages/ui/src/pages/ProgramsNew.tsx`, `packages/ui/src/components/Layout.tsx`
- Briefing type from getInboxAll: `{ id, generatedAt, sections: Record<string, unknown>, status, type }` — no programId on briefing
- HomeBriefs currently shows all sections inline (evidence, memories, actions, correction hook)
- Need to make cards collapsible: collapsed shows badge+timestamp+title+recommendation, expanded shows the rest
- ChevronRightIcon already imported — will use it with rotation transform for expand/collapse

### Plan
10 tasks total, executing in order per spec. Starting with task 1: collapsible brief cards.

### Task 1 approach
- Add `useState<string | null>(null)` for `expandedId`
- Split card content: always-visible (header, title, recommendation summary) vs expanded (what_changed, evidence, memories, actions, correction hook)
- Click handler toggles expandedId
- Expanded section: `overflow-hidden transition-all duration-300` with max-h trick
- Chevron rotates via `transition-transform rotate-90` when expanded

### Task 1 complete
- Implemented collapsible brief cards in HomeBriefs.tsx
- Added `expandedId` state, ChevronDownIcon with rotation, max-h transition
- Collapsed: badge + timestamp + title + recommendation summary (line-clamped)
- Expanded: what_changed, recommendation detail, evidence, memories, actions, correction hook
- TypeScript check passes with zero errors
- Committed: `3761613`
- Next: Task 2 — spacing consistency

### Task 2 complete
- Normalized all fractional spacing to 4px grid in both HomeBriefs.tsx and ProgramsNew.tsx
- Replaced: gap-0.5→gap-1, mt-0.5→mt-1, mt-1.5→mt-2, px-1.5→px-2, px-2.5→px-3, left-2.5→left-3, gap-1.5→gap-2
- Card padding: p-5→p-4, brief card container gap: gap-4→gap-6
- TypeScript check passes with zero errors
- Committed: `bf1685d`
- Next: Task 3 — typography lockdown

### Task 3 complete
- Typography lockdown enforced on both HomeBriefs.tsx and ProgramsNew.tsx
- Fixed off-spec sizes: text-[11px]→text-[10px], text-[9px]→text-[10px], text-[8px]→text-[10px]
- Fixed font weights: font-medium→font-semibold on all card titles
- Fixed h4 label tracking: tracking-[0.15em]→tracking-wider (section headers keep tracking-[0.15em])
- Fixed recommendation label: text-primary/60→text-muted-foreground/50, body text-sm→text-xs
- Fixed meta opacity: /50→/40 where spec requires
- Removed tracking-tight from ProgramsNew page title
- Empty state text-sm→text-xs
- TypeScript check passes with zero errors
- Committed: `7f61ae2`
- Next: Task 4 — fade-in on data load

### Task 4 complete
- Added `animate-in fade-in-0 duration-300` to brief cards (HomeBriefs) and table rows (ProgramsNew)
- Staggered delays: `style={{ animationDelay: '${i * 50}ms' }}` per item
- tw-animate-css provides animate-in/fade-in-0 classes (already in project deps)
- TypeScript check passes with zero errors
- Committed: `fceb7d9`
- Next: Task 5 — empty states (both pages)

### Task 5 complete
- Implemented empty states for both pages
- HomeBriefs: "Your first brief will appear after your first Program runs" + "Create Program" button → /programs
- ProgramsNew no-programs: "Track an ongoing decision" headline + subtitle with examples + "Create your first program" button opens dialog
- ProgramsNew filtered: "No programs match this filter" + "Clear filter" button resets search and tab to active
- TypeScript check passes with zero errors
- Committed: `1dc3ec9`
- Next: Task 6 — skeleton shapes (both pages)

### Task 6 complete
- Updated HomeBriefs skeleton: badge (w-16 h-4), title (w-3/4 h-5), recommendation (w-full h-12), removed extra line
- Updated ProgramsNew skeleton: table row shapes matching grid-cols-[2fr_1fr_1fr_1.5fr_auto] with name+subtitle, status badge, cadence, latest+next, action dot
- Spacing between skeleton cards: space-y-6 (was space-y-8)
- TypeScript check passes with zero errors
- Committed: `5f34752`
- Next: Task 7 — brief priority indicators

### Task 7 complete
- Added four priority indicators to HomeBriefs.tsx brief cards
- High confidence: `border-l-2 border-l-emerald-500` via cn() conditional
- Open actions: amber dot (size-1.5 rounded-full bg-amber-400) next to title
- Older than 24h: `opacity-70` via cn() conditional (86400000ms check)
- Program badge: built briefIdToProgram map from programs data (latestBriefId + latestBriefSummary.id), shows Badge with program title
- TypeScript check passes with zero errors
- Committed: `d7284d6`
- Next: Task 8 — table micro-interactions (ProgramsNew.tsx)

### Task 8 complete
- Added three table micro-interactions to ProgramsNew.tsx
- Row hover: `hover:translate-x-0.5 transition-all` (replaced transition-colors with transition-all)
- Running badge: `animate-pulse` conditionally applied via cn() when status is "running"
- Delete confirmation: replaced window.confirm with Dialog component, added deleteTarget state + confirmDelete handler
- TypeScript check passes with zero errors
- Committed: `d41c0a7`
- Next: Task 9 — toggle bar → sidebar pill (Layout.tsx)

### Task 9 complete
- Removed full-width toggle bar from top of Layout.tsx
- Added compact pill button at bottom of desktop sidebar nav
- Pill shows "✨ New" when newUI active, "Classic" when legacy
- Same reload-on-click behavior preserved
- TypeScript check passes with zero errors
- Committed: `d757935`
- Next: Task 10 — brief action buttons (HomeBriefs.tsx)

### Task 10 complete
- Added two ghost action buttons to expanded brief card content
- "Ask follow-up" → navigates to /ask
- "View full brief" → navigates to /inbox/:id (with ArrowRightIcon)
- Used Button component with variant="ghost" size="xs" in a flex row
- Replaced the old single link-style "View full brief" button
- TypeScript check passes with zero errors
- Committed: `95d648b`

### ALL TASKS COMPLETE
- All 10 tasks closed, no open tasks remaining
- pnpm build: passes (all packages)
- pnpm test: 55 files, 998 tests, all pass
- Ready to emit LOOP_COMPLETE
