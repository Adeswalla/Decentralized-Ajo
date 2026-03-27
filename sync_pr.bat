@echo off
git remote add base_fork https://github.com/Adeswalla/Decentralized-Ajo.git
git fetch base_fork main
git checkout fixed-branch
git merge base_fork/main -m "merge: sync with base fork main branch"
git push origin fixed-branch
