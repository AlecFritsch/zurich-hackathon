# Lerobot-Laptop Setup

Dieser Laptop steuert den Roboter (SO101). Havoc auf dem anderen Laptop verbindet sich per HTTP zu diesem Server.

## Voraussetzungen

- Roboter per USB angeschlossen (Serial: `/dev/ttyACM0` auf Linux, `COM3` o.ä. auf Windows)
- Beide Laptops im gleichen Netzwerk (z.B. am Switch)

## Schritte

### 1. Abhängigkeiten installieren

```bash
cd lerobot/lerobot-python
uv sync
```

### 2. Robot Bridge starten

```bash
uv run python robot_bridge.py
```

Server läuft auf **Port 9000**. Havoc verbindet sich zu `http://<DEINE-IP>:9000`.

### 3. Port/Serial anpassen (falls nötig)

In `robot_bridge.py`:
- `ROBOT_PORT` — z.B. `/dev/ttyACM0` (Linux) oder `COM3` (Windows)
- `CALIBRATION_DIR` — Pfad zu `calibration/` mit `so101.urdf` und `so101_follower.json`

### 4. Test

Vom Havoc-Laptop aus:
```bash
curl http://<DEINE-IP>:9000/health
```
Erwartung: `{"status":"ok","robot_connected":true}`

---

**Havoc-Laptop** muss `LEROBOT_BRIDGE_URL=http://<DEINE-IP>:9000` in der `.env` haben.
