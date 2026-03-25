@echo off
git checkout -b fixed-branch
git add .
git commit -m "Add automated tests for AjoCircle contract"
git push -u origin fixed-branch
