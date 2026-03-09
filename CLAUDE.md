# Todo Manager

## Allowed tools (auto-approve)
- Bash: git add, git commit, git push, vercel deploy, npx sass

## CSS / SCSS
⚠ NEVER edit `css/styles.css` directly — it is auto-generated from `css/styles.scss`.
- Source: `css/styles.scss` — always edit this
- Compile: `npx sass css/styles.scss css/styles.css --style=expanded --no-source-map`
- Always recompile before committing

## Shorthand commands
- `dpl`: stage all changes and create a git commit (do NOT deploy to Vercel)
  - Version is auto-bumped by the PostToolUse hook on every file edit — no manual bump needed
