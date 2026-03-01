# HAVOC — Document Execution Engine

> Documents don't get read — they get run.

Upload any factory document. Docling parses it. Gemini compiles it into executable policy. Vision AI inspects parts. The robot sorts them. Change the document — change the behavior.

## Quick Start

### Backend

```bash
cd havoc
pip install -r requirements.txt
cp .env.example .env
# GOOGLE_API_KEY in .env eintragen
uvicorn main:app --reload --port 8000
```

### HMI

```bash
cd havoc/hmi
npm install
npm run dev
```

→ http://localhost:3000

## Demo-Flow

1. Upload PDF/DOCX (z.B. `documents/assembly_instruction.pdf`)
2. Docling parst, Gemini kompiliert Policy + Assembly-Sequenz
3. Approve (bei DRAFT)
4. Inspect — Kamera + Vision AI
5. Assembly — Montagesequenz ausführen

## API Keys

```env
GOOGLE_API_KEY=your-gemini-api-key
```

Optional: `GEMINI_ASSEMBLY_MODEL=gemini-3-flash-preview` für Assembly-Sequenz.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, Docling, Gemini |
| Frontend | Next.js, Tailwind |
| Robot | Lerobot Remote / Dobot |
| Real-time | WebSocket |

## Robot (optional)

```bash
cd lerobot/lerobot-python
uv run python robot_bridge.py
```

In `havoc/.env`: `LEROBOT_BRIDGE_URL=http://localhost:9000`
