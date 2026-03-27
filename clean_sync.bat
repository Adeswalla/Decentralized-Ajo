@echo off
git fetch origin fixed-branch
git reset origin/fixed-branch
git add components/ui/calendar.tsx lib/stellar-config.ts
git commit -m "fix: resolve Next.js TypeScript compilation errors breaking the 9s CI pipeline"
git push origin fixed-branch
