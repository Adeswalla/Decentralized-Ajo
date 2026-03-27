@echo off
git rm -f contracts/ajo-circle/Cargo.lock
git commit -m "fix: remove Cargo.lock to prevent version 4 CI parser errors"
git push origin fixed-branch
