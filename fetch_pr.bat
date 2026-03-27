@echo off
git fetch origin pull/185/head:pr-185
git checkout pr-185
type package.json | findstr nodemailer
