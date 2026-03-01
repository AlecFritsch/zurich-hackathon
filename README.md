# Zurich Hackathon — HAVOC

**Document Execution Engine** — Dokumente werden geparst, in ausführbare Policies kompiliert, Vision AI inspiziert Teile, der Roboter sortiert. Ändere das Dokument — ändere das Verhalten.

## Quick Start

```bash
# Backend
cd havoc
pip install -r requirements.txt
cp .env.example .env
# GOOGLE_API_KEY in .env eintragen
uvicorn main:app --host 0.0.0.0 --port 8000

# HMI (anderes Terminal)
cd havoc/hmi
npm install
npm run dev
```

→ **http://localhost:3000**

## Demo-Flow

1. **Upload** — PDF oder DOCX (z.B. `havoc/documents/assembly_instruction.pdf`)
2. **Processing** — Docling parst, Gemini kompiliert Policy + Assembly-Sequenz
3. **Approve** — Policy genehmigen (bei DRAFT)
4. **Inspect** — Kamera + Vision AI (Header)
5. **Assembly** — Montagesequenz ausführen (Header)

## Projektstruktur

| Ordner | Beschreibung |
|--------|--------------|
| **havoc/** | FastAPI Backend, Next.js HMI, Docling, Gemini |
| **lerobot/** | Robot Stack (SO101, Bridge) |
| **humanCentricInstructionUnderstandingForRobotTaskPlanning/** | Notebook-Referenz |

## API

- `POST /documents/upload` — Dokument hochladen
- `POST /inspect` — Teil inspizieren
- `GET /camera/snapshot` — Kamera-Snapshot

## Dokumentation

- [havoc/README.md](havoc/README.md) — Backend & HMI Details
