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
        current_angles = self.get_joint_angles()
        target_angles = self.inverse_kinematics(x, y, z, joint_angles=current_angles)

        delta = target_angles - current_angles

        steps = max(1, int(duration / dt))
        for step in range(steps):
            t = (step + 1) / steps
            angles = current_angles + delta * t
            self.set_joint_angles(angles)
            time.sleep(dt)
        self.set_joint_angles(target_angles)

    def open_gripper(self, duration=0.5, open_position=10.0):
        command = {'gripper.pos': open_position}
        self.robot.send_action(command)
        time.sleep(duration)  # Wait for the gripper to open

    def close_gripper(self, duration=0.5):
        command = {'gripper.pos': 0.0}
        self.robot.send_action(command)
        time.sleep(duration)  # Wait for the gripper to close


if __name__ == "__main__":

    with RobotController("/dev/ttyACM0", "/home/enrico/Dev/lerobot/lerobot-python/calibration") as controller:
        while True:
            print(controller.get_joint_angles())
            time.sleep(0.1)

        # more example usage:
        joint_angles = controller.get_joint_angles()
        print("Current joint angles:", joint_angles)

        T = controller.get_transform(joint_angles)
        print("Current end-effector transform:\n", T)

        # Example: Move the end-effector to a new position (x, y, z)
        target_x, target_y, target_z = 0.15, 0.01, 0.077
        new_angles = controller.inverse_kinematics(target_x, target_y, target_z)
        print("Calculated joint angles for target position:", new_angles)

        controller.move_to_position(0.15, 0.0, 0.075, duration=1)
        controller.open_gripper()
        controller.move_to_position(0.15, 0.0, 0.01, duration=1)
        controller.close_gripper()
        controller.move_to_position(0.15, 0.0, 0.075, duration=1)
        controller.move_to_position(0.15, 0.03, 0.075, duration=1)
        controller.move_to_position(0.15, 0.03, 0.01, duration=1)
        controller.open_gripper()
        controller.move_to_position(0.15, 0.03, 0.075, duration=1)
        controller.move_to_position(0.15, 0.0, 0.075, duration=1)

        input("Press Enter to exit...")

