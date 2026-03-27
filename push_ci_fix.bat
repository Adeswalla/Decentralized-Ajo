@echo off
git add .github/workflows/ci.yml
git commit -m "fix: upgrade rust toolchain to stable to support edition 2024"
git push origin fixed-branch
