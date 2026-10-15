# Bubsy Windows Packaging & Startup Script (PowerShell)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "       Bubsy -- The AI Handwashing Adventure            " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# 1. Verify virtual environment
$PythonExe = Join-Path $ProjectRoot "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Error "Python virtual environment not found in backend\.venv. Follow INSTALL.md to configure."
    exit 1
}

# 2. Check if frontend build exists; build if missing
$FrontendDist = Join-Path $ProjectRoot "frontend\dist\index.html"
if (-not (Test-Path $FrontendDist)) {
    Write-Host "[Bubsy] Frontend distribution not found. Building production bundle..." -ForegroundColor Yellow
    npm --prefix frontend run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Frontend production build failed."
        exit 1
    }
}

# 3. Run database migrations & recovery
Write-Host "[Bubsy] Running database migrations and crash recovery..." -ForegroundColor Green
$env:PYTHONPATH = "backend;$env:PYTHONPATH"
& $PythonExe -m app.database.migrations.runner
if ($LASTEXITCODE -ne 0) {
    Write-Error "Database migrations failed."
    exit 1
}

# 4. Start backend bound to 127.0.0.1:8000
Write-Host "[Bubsy] Starting backend daemon bound to 127.0.0.1:8000..." -ForegroundColor Green
$BackendProc = Start-Process -FilePath (Join-Path $ProjectRoot "backend\.venv\Scripts\uvicorn.exe") `
    -ArgumentList "app.main:app", "--app-dir", "backend", "--host", "127.0.0.1", "--port", "8000" `
    -WindowStyle Hidden -PassThru

# 5. Serve frontend on 127.0.0.1:5173
Write-Host "[Bubsy] Serving production frontend on 127.0.0.1:5173..." -ForegroundColor Green
$FrontendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm", "--prefix", "frontend", "run", "preview", "--", "--host", "127.0.0.1", "--port", "5173" `
    -WindowStyle Hidden -PassThru

# 6. Wait for service readiness
Write-Host "[Bubsy] Waiting for service readiness..." -ForegroundColor Yellow
& $PythonExe (Join-Path $ProjectRoot "scripts\wait_for_service.py")
if ($LASTEXITCODE -ne 0) {
    Write-Warning "[Bubsy] Health endpoint timed out; launching kiosk anyway."
}

# 7. Launch full-screen kiosk browser
Write-Host "[Bubsy] Launching kiosk interface in full-screen mode..." -ForegroundColor Cyan
$EdgePath = "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $EdgePath)) {
    $EdgePath = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
}

if (Test-Path $EdgePath) {
    Start-Process $EdgePath -ArgumentList "--kiosk", "http://127.0.0.1:5173/kiosk", "--edge-kiosk-type=fullscreen", "--no-first-run", "--disable-pinch"
} else {
    Start-Process "http://127.0.0.1:5173/kiosk"
}

Write-Host "[Bubsy] System successfully started and kiosk opened." -ForegroundColor Green
