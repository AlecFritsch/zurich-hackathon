from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .robot_controller import RobotController

app = FastAPI()

# You may want to configure these paths as needed
ROBOT_PORT = "/dev/ttyACM0"
CALIBRATION_DIR = "/home/enrico/Dev/zurich-hackathon/lerobot/lerobot-python/calibration"

class MoveRequest(BaseModel):
    x: float
    y: float
    z: float
    duration: float

class GripRequest(BaseModel):
    state: str  # "open" or "closed"

@app.post("/move")
def move(req: MoveRequest):
    try:
        with RobotController(ROBOT_PORT, CALIBRATION_DIR) as controller:
            controller.move_to_position(req.x, req.y, req.z, req.duration)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/grip")
def grip(req: GripRequest):
    try:
        with RobotController(ROBOT_PORT, CALIBRATION_DIR) as controller:
            if req.state == "open":
                controller.open_gripper()
            elif req.state == "closed":
                controller.close_gripper()
            else:
                raise HTTPException(status_code=400, detail="Invalid state. Use 'open' or 'closed'.")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
