# HAVOC — Document Execution Engine

> Documents don't get read — they get run.

Upload any factory document. Docling parses it. Gemini compiles it into executable policy. Vision AI inspects parts. The robot sorts them. Change the document — change the behavior. Zero code changes.

## Quick Start

### 1. Backend

```bash
cd havoc
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your GOOGLE_API_KEY
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd havoc/hmi
npm install
npm run dev
```

Open http://localhost:3000

### 3. Demo Flow

1. Upload `sorting_procedure_v3.md` (or PDF/DOCX)
2. System parses via Docling, compiles policy via Gemini
3. Approve the policy
4. Click INSPECT — camera captures, Gemini classifies, robot sorts
5. Upload `sorting_procedure_v4.md` — thresholds change, behavior changes
6. Upload `machine_spec.md` — cross-document conflict detected

## Architecture

```
Document (PDF/DOCX/Image)
  → Docling (TableFormer, OCR, Layout Analysis)
  → Gemini (Policy Compilation)
  → Human Approval
  → Vision AI (Classify + Defect Detect)
  → Rule Engine (Safe evaluation)
  → Robot Adapter (Lerobot Remote / Dobot CR)
  → HMI (Swiss Brutalism Dashboard)
```

**Hybrid Architecture:**
- LangGraph Supervisor for document/report flows (multi-step reasoning)
- Direct async pipeline for inspection (sub-3s latency)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python + FastAPI |
| Multi-Agent | LangChain + LangGraph |
| Document AI | Docling (local) |
| LLM | Gemini 3.1 Pro Preview (Policy, Q&A) + Gemini Robotics-ER 1.5 (Inspection, Robot) |
| Vision | OpenCV + Gemini Vision |
| Robot | Lerobot Remote / Dobot CR |
| Frontend | Next.js + Tailwind |
| Database | SQLite (WAL mode) |
| Real-time | WebSocket |

## Camera OCR & Calibration

- **POST /camera/ocr** — Capture frame, undistort (if calibrated), run Gemini 3.1 Pro Preview OCR. Returns `{parts: [{part_type, detected_text}]}`.
- Calibration: Run `calibration.py` (root) to produce `usb_camera_intrinsics.npz`. Place in project root. Undistortion applies to stream, snapshot, and OCR.

## API Keys & Model

```env
GOOGLE_API_KEY=your-gemini-api-key
```

Default models: **gemini-3.1-pro-preview** (Policy, OCR, Q&A) | **gemini-robotics-er-1.5-preview** (Inspection, Robot). Override via `GEMINI_MODEL`, `GEMINI_ORCHESTRATOR_MODEL`, `GEMINI_VISION_MODEL` in `.env`.

## Distributed Setup (Lerobot auf anderem Laptop)

Wenn der Roboter (Lerobot SO101) auf einem anderen Laptop läuft:

**1. Auf Lerobot-Laptop** (mit Serial-Port):
```bash
cd lerobot/lerobot-python
uv sync
uv run python robot_bridge.py
# Oder: uvicorn robot_bridge:app --host 0.0.0.0 --port 9000
```

**2. In havoc/.env** (auf diesem Laptop):
```env
ROBOT_TYPE=lerobot_remote
LEROBOT_BRIDGE_URL=http://<IP-Lerobot-Laptop>:9000
```

**3. Netzwerk:** Beide Laptops im gleichen Netzwerk. IP des Lerobot-Laptops in LEROBOT_BRIDGE_URL eintragen.

That's it. Everything else is local.
