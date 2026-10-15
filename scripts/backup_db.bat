@echo off
setlocal
cd /d "%~dp0\.."

echo [Bubsy] Creating atomic SQLite backup...
backend\.venv\Scripts\python.exe scripts\backup_db.py %*
if errorlevel 1 (
    echo [Bubsy] Backup failed.
    exit /b 1
)
echo [Bubsy] Backup complete.
