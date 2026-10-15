# Bubsy SQLite Atomic Backup Script (PowerShell)
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

Write-Host "[Bubsy] Creating atomic SQLite database backup..." -ForegroundColor Cyan
& "$ProjectRoot\backend\.venv\Scripts\python.exe" "$ProjectRoot\scripts\backup_db.py" $args
if ($LASTEXITCODE -eq 0) {
    Write-Host "[Bubsy] Backup successful." -ForegroundColor Green
} else {
    Write-Error "[Bubsy] Backup failed with exit code $LASTEXITCODE."
}
