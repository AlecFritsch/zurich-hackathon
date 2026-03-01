"""Robot Bridge — REST API für Lerobot SO101.

Läuft auf dem Laptop mit Roboter (Serial-Port). Havoc ruft diesen Server per HTTP auf.

Start (auf Lerobot-Laptop):
    uv run python robot_bridge.py

Oder mit uvicorn:
    uvicorn robot_bridge:app --host 0.0.0.0 --port 9000
"""

from contextlib import asynccontextmanager
from pathlib import Path
import sys

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Lokaler Import — nur auf Lerobot-Laptop mit Serial-Port
try:
    from robot_controller import RobotController
    HAS_ROBOT = True
except ImportError:
    HAS_ROBOT = False
    RobotController = None

# Pfad zur Kalibrierung — anpassen!
CALIBRATION_DIR = Path(__file__).resolve().parent / "calibration"
ROBOT_PORT = "COM9" if sys.platform == "win32" else "/dev/ttyACM0"

_controller = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _controller
    if HAS_ROBOT:
        try:
            _controller = RobotController(ROBOT_PORT, str(CALIBRATION_DIR))
            _controller.__enter__()
            print("Robot connected")
        except Exception as e:
            print(f"Robot init failed: {e}")
            _controller = None
    yield
    if _controller:
        try:
            _controller.__exit__(None, None, None)
        except Exception:
            pass
        _controller = None


app = FastAPI(title="Lerobot Bridge", lifespan=lifespan)


class MoveRequest(BaseModel):
    x: float  # Meter
    y: float
    z: float
    duration: float = 1.0


class GripRequest(BaseModel):
    action: str  # "open" | "close"


@app.get("/health")
async def health():
    return {"status": "ok", "robot_connected": _controller is not None}


@app.get("/heartbeat")
async def heartbeat():
    if not _controller:
        raise HTTPException(503, "Robot not connected")
    try:
        angles = _controller.get_joint_angles()
        return {"status": "OK", "joints": angles.tolist()}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/move")
async def move(req: MoveRequest):
    """Bewegt Endeffektor zu x,y,z (Meter)."""
    if not _controller:
        raise HTTPException(503, "Robot not connected")
    try:
        _controller.move_to_position(req.x, req.y, req.z, duration=req.duration)
        return {"status": "OK", "position": [req.x, req.y, req.z]}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/grip")
async def grip(req: GripRequest):
    """Öffnet oder schließt den Greifer."""
    if not _controller:
        raise HTTPException(503, "Robot not connected")
    try:
        if req.action.lower() == "close":
            _controller.close_gripper()
        else:
            _controller.open_gripper()
        return {"status": "OK", "action": req.action}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/joints")
async def get_joints():
    if not _controller:
        raise HTTPException(503, "Robot not connected")
    try:
        angles = _controller.get_joint_angles()
        return {"joints": angles.tolist()}
    except Exception as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
