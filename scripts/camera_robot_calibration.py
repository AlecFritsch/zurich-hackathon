"""ArUco Touch Calibration — Kamera ↔ Roboter-Basis.

Place ArUco marker (ID 2, 50mm) on table. Move robot gripper to touch marker center.
Press 'c' to capture (min 5 points). Saves cam_to_robot_transform.npy to project root.

Env: CALIBRATION_CAMERA=0|1, LEROBOT_BRIDGE_URL for live joint angles (optional).
"""

import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MARKER_SIZE = 0.05  # 50mm
REQUIRED_POINTS = 5
CAMERA_INDEX = int(os.environ.get("CALIBRATION_CAMERA", "0"))

# Load intrinsics from usb_camera_intrinsics.npz if available
calib_path = ROOT / "usb_camera_intrinsics.npz"
if calib_path.exists():
    data = np.load(calib_path)
    camera_matrix = data["mtx"]
    dist_coeffs = data["dist"].flatten()
else:
    camera_matrix = np.array([
        [7.43979721e+03, 0.0, 1.10337352e+03],
        [0.0, 7.38832199e+03, 8.10731785e+02],
        [0.0, 0.0, 1.0]
    ], dtype=np.float64)
    dist_coeffs = np.array([-0.72200534, -0.08970809, -0.03362853, -0.01038592, 1.48548678])

# Try Robot Bridge for live joint angles
BRIDGE_URL = os.environ.get("LEROBOT_BRIDGE_URL", "http://localhost:9000")


def get_robot_tip_position():
    """Get gripper position: from Bridge /joints + Pinocchio FK, or dummy."""
    try:
        import urllib.request
        with urllib.request.urlopen(f"{BRIDGE_URL}/joints", timeout=2) as r:
            data = __import__("json").load(r)
            joint_angles = data.get("joints", [0.0] * 6)
    except Exception:
        joint_angles = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

    urdf_path = ROOT / "lerobot" / "lerobot-python" / "calibration" / "so101.urdf"
    if not urdf_path.exists():
        return np.array(joint_angles[:3], dtype=np.float64)  # fallback dummy

    try:
        import pinocchio as pin
        model = pin.buildModelFromUrdf(str(urdf_path))
        data = model.createData()
        ee_id = model.getFrameId("gripper_link") if model.existFrame("gripper_link") else -1
        if ee_id < 0:
            ee_id = model.nframes - 1
        q = np.array(joint_angles[: model.nq], dtype=np.float64)
        pin.forwardKinematics(model, data, q)
        pin.updateFramePlacements(model, data)
        return data.oMf[ee_id].translation.copy()
    except Exception:
        return np.array(joint_angles[:3], dtype=np.float64)


half_size = MARKER_SIZE / 2.0
obj_points = np.array([
    [-half_size, half_size, 0], [half_size, half_size, 0],
    [half_size, -half_size, 0], [-half_size, -half_size, 0]
], dtype=np.float32)

aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
detector = cv2.aruco.ArucoDetector(aruco_dict, cv2.aruco.DetectorParameters())

apis = [cv2.CAP_DSHOW, cv2.CAP_MSMF] if sys.platform == "win32" else [cv2.CAP_V4L2, cv2.CAP_ANY]
cap = None
for api in apis:
    cap = cv2.VideoCapture(CAMERA_INDEX, api)
    if cap.isOpened():
        break
if not cap or not cap.isOpened():
    print("[FAIL] Camera not available. Try CALIBRATION_CAMERA=0 or 1.")
    sys.exit(1)

cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

points_cam = []
points_robot = []

print("\n--- TOUCH CALIBRATION ---")
print("1. Place ArUco marker (ID 2, 50mm) flat on table.")
print("2. Move robot gripper to touch marker CENTER.")
print("3. Press 'c' to capture. Need", REQUIRED_POINTS, "points.")
print("4. Press 'q' when done.")

try:
    while len(points_cam) < REQUIRED_POINTS:
        ret, frame = cap.read()
        if not ret:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        corners, ids, _ = detector.detectMarkers(gray)
        marker_tvec = None
        if ids is not None and 2 in ids:
            idx = int(np.where(ids == 2)[0][0])
            mc = corners[idx][0]
            ok, rvec, tvec = cv2.solvePnP(obj_points, mc, camera_matrix, dist_coeffs)
            if ok:
                marker_tvec = tvec.flatten()
                cv2.aruco.drawDetectedMarkers(frame, corners, ids)
                cv2.drawFrameAxes(frame, camera_matrix, dist_coeffs, rvec, tvec, MARKER_SIZE)
                cv2.putText(frame, f"Cam: {marker_tvec[0]:.3f} {marker_tvec[1]:.3f} {marker_tvec[2]:.3f}",
                            (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.putText(frame, f"Captured: {len(points_cam)}/{REQUIRED_POINTS}", (20, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
        cv2.imshow("Touch Calibration", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("c"):
            if marker_tvec is not None:
                robot_pos = get_robot_tip_position()
                points_cam.append(marker_tvec)
                points_robot.append(robot_pos)
                print(f"Point {len(points_cam)}: cam {marker_tvec}, robot {robot_pos}")
                time.sleep(0.5)
            else:
                print("Marker ID 2 not visible.")
        elif key == ord("q"):
            break
finally:
    cap.release()
    cv2.destroyAllWindows()

if len(points_cam) >= 4:
    pts_cam = np.array(points_cam, dtype=np.float64)
    pts_robot = np.array(points_robot, dtype=np.float64)
    retval, aff, inliers = cv2.estimateAffine3D(pts_cam, pts_robot)
    if retval:
        T = np.vstack((aff, [0, 0, 0, 1]))
        out_path = ROOT / "cam_to_robot_transform.npy"
        np.save(out_path, T)
        print(f"\n[OK] Saved to {out_path}")
    else:
        print("\n[FAIL] Could not compute transform.")
else:
    print(f"\n[FAIL] Need >= 4 points, got {len(points_cam)}.")
