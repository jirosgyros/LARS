@echo off
cd /d "%~dp0"
node job-search.js scrape
node job-search.js rank
