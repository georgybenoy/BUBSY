@echo off
setlocal
cd /d "%~dp0"

echo =========================================================
echo       Bubsy -- The AI Handwashing Adventure
echo =========================================================

:: 1. Verify virtualenv exists
if not exist "backend\.venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found in backend\.venv.
    echo Please follow INSTALL.md to configure the environment.
    pause
    exit /b 1
)

:: 2. Check if frontend build exists; if not, build it
if not exist "frontend\dist\index.html" (
    echo [Bubsy] Frontend distribution not found. Building production bundle...
    npm --prefix frontend run build
    if errorlevel 1 (
        echo [ERROR] Frontend build failed.
        pause
        exit /b 1
    )
)

:: 3. Run database migrations & recovery
echo [Bubsy] Running database migrations and crash recovery...
set PYTHONPATH=backend;%PYTHONPATH%
backend\.venv\Scripts\python.exe -m app.database.migrations.runner
if errorlevel 1 (
    echo [ERROR] Database migrations failed.
    pause
    exit /b 1
)

:: 4. Start backend server bound strictly to 127.0.0.1:8000
echo [Bubsy] Starting backend daemon bound to 127.0.0.1:8000...
start "Bubsy Backend" /min backend\.venv\Scripts\uvicorn.exe app.main:app --app-dir backend --host 127.0.0.1 --port 8000

:: 5. Start static frontend server on 127.0.0.1:5173
echo [Bubsy] Serving production frontend on 127.0.0.1:5173...
start "Bubsy Frontend" /min cmd /c npm --prefix frontend run preview -- --host 127.0.0.1 --port 5173

:: 6. Wait for backend health check
echo [Bubsy] Waiting for service readiness...
backend\.venv\Scripts\python.exe scripts\wait_for_service.py

:: 7. Launch Kiosk in Full-Screen Browser (Edge or Chrome)
echo [Bubsy] Launching kiosk interface in full-screen mode...
where msedge >nul 2>nul
if %errorlevel% equ 0 (
    start msedge --kiosk http://127.0.0.1:5173/kiosk --edge-kiosk-type=fullscreen --no-first-run --disable-pinch
) else (
    where chrome >nul 2>nul
    if %errorlevel% equ 0 (
        start chrome --kiosk http://127.0.0.1:5173/kiosk --no-first-run --disable-pinch
    ) else (
        start http://127.0.0.1:5173/kiosk
    )
)

echo [Bubsy] System successfully initialized and active.
