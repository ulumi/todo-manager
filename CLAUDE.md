# Todo Manager

## Allowed tools (auto-approve)
- Bash: git add, git commit, git push, vercel deploy

## Shorthand commands
- `dpl`: before committing, auto-increment the version number:
  1. Read current version integer from `js/modules/version.js`
  2. Increment it by 1
  3. Update `js/modules/version.js` (export const VERSION = '<new>';)
  4. Update `README.md` (the number under `## Version`)
  5. Then stage all changes and create a git commit (do NOT deploy to Vercel)
