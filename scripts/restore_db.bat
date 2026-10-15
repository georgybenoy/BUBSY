@echo off
setlocal
cd /d "%~dp0\.."

if "%~1"=="" (
    echo Usage: restore_db.bat ^<path_to_backup_file.db^>
    exit /b 1
)

echo [Bubsy] Restoring SQLite database from %1...
backend\.venv\Scripts\python.exe scripts\restore_db.py "%~1"
if errorlevel 1 (
    echo [Bubsy] Restore failed.
    exit /b 1
)
echo [Bubsy] Restore complete.
