# Bubsy SQLite Database Restore Script (PowerShell)
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

Write-Host "[Bubsy] Restoring SQLite database from $BackupFile..." -ForegroundColor Cyan
& "$ProjectRoot\backend\.venv\Scripts\python.exe" "$ProjectRoot\scripts\restore_db.py" "$BackupFile"
if ($LASTEXITCODE -eq 0) {
    Write-Host "[Bubsy] Restore verified and successful." -ForegroundColor Green
} else {
    Write-Error "[Bubsy] Restore failed with exit code $LASTEXITCODE."
}
