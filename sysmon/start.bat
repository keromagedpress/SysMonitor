@echo off
setlocal enabledelayedexpansion
echo === SysMonitor AI - Starting ===

:: ── Backend ─────────────────────────────────────────────────────────────────
cd backend

if not exist ".venv" (
    echo [Backend] Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo [Backend] Installing dependencies...
pip install -r requirements.txt -q

echo [Backend] Starting on http://localhost:8000 ...
start "SysMonitor-Backend" cmd /k "call .venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

cd ..

:: ── Frontend ─────────────────────────────────────────────────────────────────
cd frontend

echo [Frontend] Installing npm packages...
call npm install --silent

echo [Frontend] Starting on http://localhost:5173 ...
start "SysMonitor-Frontend" cmd /k "npm run dev"

cd ..

echo.
echo === Application Running ===
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo Both services launched in separate windows.
echo Close those windows or press Ctrl+C in each to stop.
echo.
pause
