@echo off
git rm --ignore-unmatch package-lock.json push.bat push_output.txt contracts/ajo-circle/test_output.txt
git add package.json
git commit -m "Fix CI default scripts and lockfiles"
git push origin fixed-branch
