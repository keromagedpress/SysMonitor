#!/bin/bash
set -e
echo "=== SysMonitor AI — Starting ==="

# ── Backend setup ────────────────────────────────────────────────────────────
cd backend
python -m venv .venv 2>/dev/null || true

# Activate on Linux/macOS
if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
  # Git Bash / MSYS on Windows
  source .venv/Scripts/activate
fi

pip install -r requirements.txt -q
echo "[Backend] Starting on http://localhost:8000 ..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# ── Frontend setup ───────────────────────────────────────────────────────────
cd frontend
npm install -q
echo "[Frontend] Starting on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=== Application Running ==="
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both services."

trap "kill \$BACKEND_PID \$FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
