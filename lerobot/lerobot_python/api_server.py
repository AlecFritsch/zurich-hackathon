from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from pathlib import Path
from lerobot.robots.so_follower.config_so_follower import SOFollowerConfig
from lerobot.robots.so_follower.so_follower import SOFollower
from lerobot.model.kinematics import RobotKinematics

import time
import numpy as np

JOINT_NAMES = [
    'shoulder_pan',
    'shoulder_lift',
    'elbow_flex',
    'wrist_flex',
    'wrist_roll',
    'gripper',
]

class RobotController():
    def __init__(self, port, calibration_dir):
        config = SOFollowerConfig(port)
        config.id = "so101_follower"
        config.calibration_dir = Path(calibration_dir)
        self.robot = SOFollower(config)
        urdf_path = str(config.calibration_dir.joinpath("so101.urdf").absolute())
        self.kinematics = RobotKinematics(urdf_path=urdf_path)

    def __enter__(self):
        # Initialization or resource acquisition
        self.robot.connect()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        # Cleanup or resource release
        self.robot.disconnect()
    
    def get_joint_angles(self):
        obs = self.robot.get_observation()
        joint_angles = np.array([obs[joint + '.pos'] for joint in JOINT_NAMES])
        return joint_angles

    def get_transform(self, joint_angles=None):
        if joint_angles is None:
            joint_angles = self.get_joint_angles()
        return self.kinematics.forward_kinematics(joint_angles)

    def set_joint_angles(self, angles):
        command = {}
        for i, joint in enumerate(JOINT_NAMES):
            command[joint + '.pos'] = angles[i]
        self.robot.send_action(command)
    
    def inverse_kinematics(self, x, y, z, joint_angles=None):
        if joint_angles is None:
            joint_angles = self.get_joint_angles()
        target_pose = self.kinematics.forward_kinematics(joint_angles)
        target_pose[:3, 3] = [x, y, z]
        return self.kinematics.inverse_kinematics(joint_angles, target_pose)
    
    def move_to_position(self, x, y, z, duration, dt=0.02):
        print(f"move_to_position: x={x}, y={y}, z={z}, duration={duration}")
        current_angles = self.get_joint_angles()
        target_angles = self.inverse_kinematics(x, y, z, joint_angles=current_angles)

        delta = target_angles - current_angles

        steps = int(duration / dt)
        for step in range(steps):
            # print(step, "/", steps)
            angles = current_angles + delta * (step / steps)
            self.set_joint_angles(angles)
            time.sleep(dt)
        self.set_joint_angles(target_angles)  # Ensure we end at the exact target angles
    
    def open_gripper(self, duration=0.5, open_position=10.0):
        command = {'gripper.pos': open_position}
        self.robot.send_action(command)
        time.sleep(duration)  # Wait for the gripper to open

    def close_gripper(self, duration=0.5):
        command = {'gripper.pos': 0.0}
        self.robot.send_action(command)
        time.sleep(duration)  # Wait for the gripper to close


SAVED_POSITIONS = {
    "part_1": [ 0.21416174, -0.01358915,  0.01251318],
    "part_2": [ 0.18637521, -0.07355577,  0.01501939],
    "part_3": [ 0.15009942, -0.13265457,  0.0130551],
    "part_4": [ 0.08019558, -0.1979668,   0.01522805],
    "home": [ 0.19090396, 0.00370703, 0.14571717]
}


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
