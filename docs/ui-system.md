# UI system

## Tokens
All tokens live in `client/src/styles/tokens.css` under `:root`.

- Surfaces: `--color-bg`, `--color-surface`, `--color-surface-raised` (user menu, toasts), `--color-surface-sunken`.
- Text: `--color-text`, `--color-text-muted`.
- Borders: `--color-border-subtle` (dividers/card edges), `--color-border` (control boundaries), `--color-border-strong` (emphasis/hover).
- Actions: primary/success/danger palettes, `--color-on-primary`, `--color-on-danger`, `--color-primary-subtle`, `--color-danger-subtle`.
- Focus/overlay: `--color-focus-ring`, `--color-overlay`.
- Shadows/scales: `--shadow-sm/md/lg`, `--space-1..7`, `--radius-sm/md/lg/full`, `--text-xs..xl`, `--font-sans`, `--font-emoji`, `--weight-medium/semibold`.
- Motion/z-index: `--dur-fast`, `--dur-base`, `--ease-standard`, `--z-header`, `--z-toast`.

Media queries use literal values: 640px, 960px, 1200px.

## Primitives
All primitives live under `client/src/components/<Name>/` and are exported from `components/index.ts`.

- `Icon` — closed `IconName` union, `size` 16/20/24, optional `title`; decorative by default. `Button` — `primary|secondary|ghost|danger`, `sm|md`, `loading`, `block`; forwardRef, label retained while loading. `IconButton` — required `label`/`icon`, `ghost|danger`, `sm|md`.
- `Card` — `as`, `header`, `footer`, `padding`; body wrapper always present. `Spinner` — numeric `size`, `label`, `decorative`; `role="status"` unless decorative. `EmptyState` — `icon`, `title`, `body`, `action`.
- `Field` — `label`, `htmlFor`, `hint`, `error`, `required`, `children`; label/error wiring. `Input`/`Select`/`Checkbox` — native attributes, forwardRef, `invalid` on Input/Select; Field context supplies hint/error `aria-describedby`.
- `AppShell` — `children`, `username`, `listCount`, `onLogout`; sticky header, user menu, Escape/outside close, focus return, logout confirmation.
- `Dialog` — native `<dialog>` + `showModal()`, labelled/described, Esc/backdrop close, size/tone, initial focus. `DialogHost` renders the serialized queue; `confirmDialog()`/`promptDialog()` are single-active, FIFO, settle-once, with focus restore.
- `Toast` — tone/message/close. `ToastHost` portals sibling `role="status"` and `role="alert"` regions; `toast.success/error/info`. Timer defaults to 5s, pauses independently on hover and focus-within, resumes with remaining duration.

## CSS Modules convention
- Styles are `*.module.css`, imported as `import styles from './x.module.css'`.
- Keys are camelCase; no BEM `__`/`--`; no LESS.
- Flat selectors only: no nesting, no `&`, no nested descendant rules.
- Merge conditional classes with `cx`; no inline styles.
- Colors and spacing use `var(--token)` only; raw color values exist only in `tokens.css`.
- Global CSS is limited to `tokens.css`, `reset.css`, `base.css`.

## Breakpoints
- 640px: AppShell header becomes two rows; item rows wrap price/actions; share form and add-item fields stack.
- 960px: desktop grid with a 280px rail; below it the rail hides and a labelled Select appears above the panel.
- 1200px: maximum content width.

## Accessibility
- Global `:focus-visible` ring from `base.css`; components never remove it.
- Icon-only controls use `aria-label` (and `title`).
- Active rail list uses `aria-current="true"` on exactly one button; mobile picker uses `aria-label="Selected list"`.
- Dialogs use native modal semantics, labelled/described, Esc/backdrop handled, focus restored.
- Toast live regions are siblings; never nested.
- Reduced motion disables spinner rotation and the dialog open animation.

## Layout
```
client/src/
  App.tsx  Login.tsx  Home.tsx  index.tsx  css.d.ts
  components/<Primitive>/<Primitive>.tsx + <primitive>.module.css
  components/AppShell/  Dialog/  Toast/
  lib/cx.ts  lib/field-aria.ts
  pages/home.module.css  pages/login.module.css
  styles/tokens.css  styles/reset.css  styles/base.css
```

## Regression gates
Run from `client/`:

```sh
npm run build
npm run typecheck
find src -name '*.less'
rg -n '\.less' src
rg -n 'less' package.json
rg -n 'style=\{\{' src
rg -nP '(?<!\.)\b(?:alert|confirm|prompt)\s*\(' src
rg -n '#[0-9a-fA-F]{3,8}\b|rgba?\(' src --glob '!**/tokens.css'
rg -n '&|^\s*@[a-z]+:' src --glob '*.css'
rg -n '__|--(primary|secondary|ghost|danger|sm|md)' src --glob '*.css'
rg -n 'home__|login__' src
rg -n 'dev/ui|DevUi' src
rg -n 'Login successful' src
rg -n 'username: .all.' src/Home.tsx
rg -n '!list\.user' src/Home.tsx
```

Expected: build/typecheck pass; the rest return zero matches except
`username: 'all'` and `!list.user`, which each return exactly one match.
