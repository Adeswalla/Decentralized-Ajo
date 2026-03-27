@echo off
git fetch --all
git status
git log --oneline -n 5
git log origin/main --oneline -n 5
