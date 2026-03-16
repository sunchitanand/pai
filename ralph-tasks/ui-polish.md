# UI Production Polish — New UI Pages

## Objective

Apply production polish to the new UI pages (HomeBriefs.tsx and ProgramsNew.tsx) behind the `useNewUI` toggle. Make them feel designed, intentional, and smooth — not prototype-y.

## Context

- Spec: `docs/plans/ui-production-polish.md`
- All work is in `packages/ui/src/pages/HomeBriefs.tsx` and `packages/ui/src/pages/ProgramsNew.tsx`
- Do NOT touch legacy pages (Inbox.tsx, Programs.tsx)
- Do NOT add new dependencies — use Tailwind CSS transitions + React state only
- Do NOT add new API calls or change the data model
- Build must pass: `pnpm build` with zero errors

## Tasks (execute in order)

### 1. Collapsible brief cards (HomeBriefs.tsx)
- Brief cards show only: type badge, timestamp, title, recommendation summary
- Click card to expand: evidence, memory assumptions, next actions, correction hook
- Use React state `expandedId` — only one card expanded at a time
- Expanded section wrapped in `overflow-hidden` with `max-h` transition
- Chevron icon rotates on expand

### 2. Spacing consistency (both pages)
- Normalize all spacing to 4px grid multiples
- Section gaps: `gap-6` (24px)
- Card padding: `p-4` (16px)
- Inline gaps: `gap-2` (8px)
- Kill all `py-2.5`, `gap-1.5`, `mb-0.5` — round to nearest 4px multiple

### 3. Typography lockdown (both pages)
Enforce exactly these sizes, no others:
- Page title: `text-base font-bold`
- Section header: `text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground/60`
- Card title: `text-sm font-semibold`
- Card body: `text-xs text-muted-foreground`
- Label: `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50`
- Meta: `text-[10px] text-muted-foreground/40`

### 4. Fade-in on data load (both pages)
- Wrap data sections in `animate-in fade-in duration-300`
- Cards stagger with increasing delay: `style={{ animationDelay: '${i * 50}ms' }}`

### 5. Empty states (both pages)
- HomeBriefs empty: "Your first brief will appear after your first Program runs" + "Create Program" button navigating to /programs
- ProgramsNew empty (no programs): "Track an ongoing decision" + subtitle with examples + "Create your first program" button opening the dialog
- ProgramsNew empty (filtered): "No programs match this filter" + "Clear filter" button

### 6. Skeleton shapes (both pages)
- HomeBriefs skeleton: badge placeholder (w-16 h-4), title line (w-3/4 h-5), recommendation block (w-full h-12)
- ProgramsNew skeleton: table row shape — name col, status col, cadence col, latest col

### 7. Brief priority indicators (HomeBriefs.tsx)
- Recommendation with high confidence → `border-l-2 border-l-emerald-500` on card
- Has open actions → small amber dot next to title
- Older than 24h → `opacity-70`
- From a Program (programId set) → show small program name badge

### 8. Table micro-interactions (ProgramsNew.tsx)
- Row hover: `hover:translate-x-0.5 transition-transform`
- Status "running" badge: `animate-pulse`
- Replace `window.confirm` for delete with the existing Dialog component

### 9. Toggle bar → sidebar pill
- Remove the full-width bar from Layout.tsx
- Add a small pill button at the bottom of the desktop sidebar: "✨ New" / "Classic"
- Keep the reload behavior on click

### 10. Brief action buttons (HomeBriefs.tsx, expanded state only)
- "Ask follow-up" → navigates to `/ask`
- "View full brief" → navigates to `/inbox/:id`
- Styled as small ghost buttons in a row at the bottom of expanded content

## Verification

After each task, run:
```
cd packages/ui && npx tsc -b --noEmit
```
Must produce zero errors.

After all tasks, run:
```
pnpm build
pnpm test
```
Both must pass.

## Commit

When all tasks pass, commit with:
```
git add packages/ui/src/pages/HomeBriefs.tsx packages/ui/src/pages/ProgramsNew.tsx packages/ui/src/components/Layout.tsx
git commit -m "feat: production polish for new UI — collapsible briefs, spacing, animations, empty states"
```


## Completion

When all tasks pass and the commit is made, output:

LOOP_COMPLETE
