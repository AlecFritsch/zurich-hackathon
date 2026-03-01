"""Camera calibration — checkerboard method. Saves usb_camera_intrinsics.npz to project root."""

import os
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent

CHECKERBOARD = (5, 4)
SQUARE_SIZE_METERS = 0.025
CAMERA_INDEX = int(os.environ.get("CALIBRATION_CAMERA", "1"))

objp = np.zeros((CHECKERBOARD[0] * CHECKERBOARD[1], 3), np.float32)
objp[:, :2] = np.mgrid[0:CHECKERBOARD[0], 0:CHECKERBOARD[1]].T.reshape(-1, 2)
objp *= SQUARE_SIZE_METERS

objpoints = []
imgpoints = []

if sys.platform.startswith("linux"):
    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_V4L2)
    print(f"Opening camera at /dev/video{CAMERA_INDEX}...")
else:
    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(CAMERA_INDEX)
    print(f"Opening camera at device {CAMERA_INDEX}...")
cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

if not cap.isOpened():
    print("[FAIL] Camera not available. Try CALIBRATION_CAMERA=0 or 1. Exiting.")
    sys.exit(1)

print("\n--- CAMERA CALIBRATION STARTED ---")
print("1. Hold the checkerboard in front of the camera so it is fully visible.")
print("2. Press 'c' to capture a pose. (Aim for 20 to 30 captures).")
print("3. Press 'q' when you are done to calculate the matrix.")

captured_frames = 0
criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame.")
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        ret_corners, corners = cv2.findChessboardCorners(gray, CHECKERBOARD, None)
        display_frame = frame.copy()

        if ret_corners:
            corners_subpix = cv2.cornerSubPix(gray, corners, (11, 11), (-1, -1), criteria)
            cv2.drawChessboardCorners(display_frame, CHECKERBOARD, corners_subpix, ret_corners)
            cv2.putText(display_frame, "BOARD DETECTED - Press 'c' to capture", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        else:
            cv2.putText(display_frame, "Searching for board...", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        cv2.putText(display_frame, f"Captured: {captured_frames} / 20+", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
        cv2.imshow("Intrinsic Calibration", display_frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord("c"):
            if ret_corners:
                objpoints.append(objp)
                imgpoints.append(corners_subpix)
                captured_frames += 1
                print(f"[OK] Captured frame {captured_frames}!")
                flash = np.ones(display_frame.shape, dtype=np.uint8) * 255
                cv2.imshow("Intrinsic Calibration", flash)
                cv2.waitKey(100)
            else:
                print("[!] Cannot capture: Whole board is not clearly visible.")
        elif key == ord("q"):
            print("\nFinishing capture phase...")
            break

finally:
    cap.release()
    cv2.destroyAllWindows()

if captured_frames >= 10:
    print(f"\nCalculating intrinsics using {captured_frames} images. Please wait...")
    ret, mtx, dist, rvecs, tvecs = cv2.calibrateCamera(objpoints, imgpoints, gray.shape[::-1], None, None)

    print("\n================ CALIBRATION SUCCESSFUL ================")
    print("\n1. Camera Matrix (mtx):\n", mtx)
    print("\n2. Distortion Coefficients (dist):\n", dist)

    mean_error = 0
    for i in range(len(objpoints)):
        imgpoints2, _ = cv2.projectPoints(objpoints[i], rvecs[i], tvecs[i], mtx, dist)
        error = cv2.norm(imgpoints[i], imgpoints2, cv2.NORM_L2) / len(imgpoints2)
        mean_error += error
    total_error = mean_error / len(objpoints)
    print(f"\nReprojection Error: {total_error:.4f} pixels")
    if total_error < 1.0:
        print("[OK] This is a good calibration!")
    else:
        print("[!] High error. You might want to redo it with more varied angles.")

    out_path = ROOT / "usb_camera_intrinsics.npz"
    np.savez(out_path, mtx=mtx, dist=dist)
    print(f"\n[OK] Matrices saved to '{out_path}'")
    print("========================================================")
else:
    print(f"\n[!] Not enough frames ({captured_frames}). Need at least 10, ideally 20+.")
