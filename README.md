# Zurich Hackathon — HAVOC

Document Execution Engine für Fabrik-Robotik. Dokumente werden geparst, in ausführbare Policies kompiliert, Vision AI inspiziert Teile, der Roboter sortiert.

## Projektstruktur

| Ordner | Beschreibung |
|--------|--------------|
| **havoc/** | Haupt-App: FastAPI Backend, Next.js HMI, Docling, Gemini, Lerobot |
| **lerobot/** | Robot Stack: SO101 Controller, Robot Bridge (REST :9000) |
| **scripts/** | Start-Skripte, Kamera-Kalibrierung, Kamera–Roboter-Kalibrierung |
| **humanCentricInstructionUnderstandingForRobotTaskPlanning/** | Experimentelles Notebook für Montageanleitungen |

## Quick Start

```powershell
# Alles starten (Robot Bridge + Havoc)
.\scripts\start.ps1
```

Oder manuell: `havoc/README.md` für Backend + HMI, `scripts/README.md` für Kalibrierung.

**Production:** `ENV=production`, `CORS_ORIGINS` und `NEXT_PUBLIC_HAVOC_URL` setzen — siehe `havoc/README.md`.

## Abhängigkeiten

| Komponente | Install |
|------------|---------|
| Havoc | `cd havoc && pip install -r requirements.txt` |
| HMI | `cd havoc/hmi && npm install` |
| Lerobot | `cd lerobot/lerobot-python && uv sync` |
| Kalibrierung | `opencv-python`, `numpy`, `pinocchio` (optional) |

## API

- `POST /documents/upload` — Dokument hochladen
- `POST /policies/compile/{doc_id}` — Policy kompilieren
- `POST /documents/{doc_id}/assembly-sequence` — Montagesequenz aus PDF (Docling + Gemini Vision)
- `POST /inspect` — Teil inspizieren (Kamera oder Base64)
- `GET /camera/snapshot` — Kamera-Snapshot

## Dokumentation

- [havoc/README.md](havoc/README.md) — Vollständige Havoc-Dokumentation
- [scripts/README.md](scripts/README.md) — Kalibrierung & Start
