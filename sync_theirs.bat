@echo off
copy /Y their_package.json package.json
call npm install
git add package.json package-lock.json
git commit -m "chore: perfectly sync package-lock.json using latest PR dependencies (pino, resend, nodemailer)"
git push origin fixed-branch
