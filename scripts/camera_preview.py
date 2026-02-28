"""Camera live preview. q=quit. Schärfung gegen Blur."""

import os
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CAMERA_INDEX = int(os.environ.get("OCR_CAMERA", "1"))

def sharpen(img, strength=1.2):
    """Unsharp mask — reduziert Blur."""
    gaussian = cv2.GaussianBlur(img, (0, 0), 2.0)
    sharp = cv2.addWeighted(img, strength, gaussian, 1 - strength, 0)
    return np.clip(sharp, 0, 255).astype(np.uint8)

cap = None
for idx in [CAMERA_INDEX, 0, 1, 2]:
    if cap:
        cap.release()
    cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap.release()
        cap = cv2.VideoCapture(idx)
    if not cap.isOpened():
        continue
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_AUTOFOCUS, 1)
    ret, _ = cap.read()
    if ret:
        print(f"Camera opened at index {idx}")
        break
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 0)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 0)
    ret, _ = cap.read()
    if ret:
        print(f"Camera opened at index {idx} (default)")
        break
if not cap or not cap.isOpened():
    print("[FAIL] No camera with frames found")
    exit(1)

got_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
got_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
print(f"Resolution: {got_w}x{got_h}")

cv2.namedWindow("Camera", cv2.WINDOW_AUTOSIZE)
print("Camera preview — q = quit")
while True:
    ret, frame = cap.read()
    if not ret:
        continue
    frame = sharpen(frame)
    cv2.imshow("Camera", frame)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
