@echo off
call npm install
git add package-lock.json
git commit -m "chore: sync package-lock.json for npm ci checks"
git push origin fixed-branch
