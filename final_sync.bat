@echo off
call npm install
git add package-lock.json
git commit -m "chore: final sync of package-lock.json with Next.js ^16.2.1"
git push origin fixed-branch
