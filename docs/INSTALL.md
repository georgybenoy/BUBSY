# Bubsy — Installation & Deployment Guide (Windows 11 / Kiosk)

**Product:** Bubsy — The AI Handwashing Adventure  
**Target Environment:** Dedicated Windows 10/11 laptop or all-in-one touch kiosk near a school washbasin.

---

## 1. System Requirements

### Hardware
- **Processor:** Intel Core i5 / AMD Ryzen 5 (4+ physical cores recommended for real-time inference)
- **RAM:** Minimum 8 GB (16 GB recommended)
- **Storage:** 500 MB free space for code, model weights, and SQLite database
- **Display:** 1080p touch display or standard monitor with mouse/touchpad
- **Camera:** 720p or 1080p USB webcam (wide-angle, minimum 30 FPS, splash-resistant enclosure)
- **Optional:** USB NFC reader (ACR122U or RC522 compatible)

### Software & Operating System
- **OS:** Windows 10 (21H2+) or Windows 11 64-bit
- **Python:** Python 3.11 or Python 3.12/3.13 64-bit ([python.org](https://www.python.org/downloads/))
- **Node.js:** Node.js v18 LTS or v20 LTS ([nodejs.org](https://nodejs.org/))
- **Browser:** Microsoft Edge (built into Windows) or Google Chrome

---

## 2. Initial Setup Steps

### Step 1: Open Terminal
Open **PowerShell** or **Command Prompt** as a standard user (administrator privilege is not required for daily operation).

```powershell
git clone https://github.com/school/bubsy.git C:\Bubsy
cd C:\Bubsy
```

### Step 2: Configure Environment File
Copy the example environment configuration:
```powershell
copy .env.example .env
```
Open `.env` in Notepad and adjust settings as appropriate:
- `SECRET_KEY`: Set a unique random key (at least 32 characters).
- `APP_ENV`: Set to `production` for school kiosk deployment.
- `HOST`: Ensure `127.0.0.1` is set (restricts traffic strictly to localhost).

### Step 3: Backend Python Virtual Environment
Create and populate the virtual environment:
```powershell
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\pip.exe install -r backend\requirements.txt
```

### Step 4: Frontend Dependencies & Production Build
Install Node dependencies and compile the optimized Vite production bundle:
```powershell
npm --prefix frontend install
npm --prefix frontend run build
```

### Step 5: Initialize Database & Create Initial Administrator
Run SQLite database migrations and create the first teacher portal administrator account:
```powershell
# Run migrations
backend\.venv\Scripts\python.exe -m app.database.migrations.runner

# Create first administrator account securely
backend\.venv\Scripts\python.exe scripts\create_admin.py --username admin --role admin
```
*You will be prompted to enter a strong password interactively. Passwords are never stored in plaintext and are hashed using Argon2id.*

### Step 6: (Optional) Seed Demo Fixture Data
To populate demo classes and students for training staff:
```powershell
backend\.venv\Scripts\python.exe scripts\seed_demo.py
```

---

## 3. Running Bubsy

### Standard One-Click Startup (Recommended)
Double-click `start_bubsy.bat` or run:
```powershell
.\start_bubsy.ps1
```
This automated script:
1. Validates dependencies and database schema version.
2. Recovers any sessions interrupted by an unexpected restart.
3. Starts the backend FastAPI daemon on `127.0.0.1:8000`.
4. Serves the production React frontend on `127.0.0.1:5173`.
5. Launches Microsoft Edge in full-screen kiosk mode displaying the student home screen.

### Accessing the Teacher Portal
On the kiosk device (or staff browser), open:
`http://127.0.0.1:5173/teacher/login`  
Log in with your administrator or teacher credentials.

---

## 4. Database Backup & Restore Operations

### Daily Backup
Run the backup script manually or configure it as a Windows Scheduled Task (e.g. daily at 18:00):
```powershell
# Creates verified backup in backups/ directory
scripts\backup_db.bat
```

### Verified Restore
To restore from a previous backup snapshot:
```powershell
# Example:
scripts\restore_db.bat backups\bubsy_backup_20261014_120000.db
```
The script automatically verifies checksums, creates a safety pre-restore snapshot of the active database, applies the backup atomically, and checks foreign keys.

---

## 5. Troubleshooting & Health Checks

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| **Kiosk displays "Camera Sensor Offline"** | Webcam unplugged or in use by another app | Ensure USB cable is plugged in. Close any apps using the camera (Zoom, Teams). Restart kiosk. |
| **Port 8000 or 5173 already in use** | Stray background uvicorn/node process | Run `Get-Process python,node \| Stop-Process` in PowerShell and re-run `start_bubsy.bat`. |
| **Invalid Credentials Error** | Username or password incorrect | Reset password via `scripts\create_admin.py --reset-password --username <username>`. |
| **Frontend changes not reflecting** | Cached preview bundle | Run `npm --prefix frontend run build` to recompile `frontend/dist/`. |
