@echo off
git fetch origin main
git merge origin/main
type package.json
