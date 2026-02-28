"""Standalone OCR — live camera, Space=OCR, q=quit. Results to ocr_results.txt."""

import cv2
import os
import sys
import json
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from PIL import Image
from google import genai
from google.genai import types
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "havoc" / ".env")
load_dotenv(ROOT / ".env")

# OCR FOV: margin from edge (0.1 = 10% each side). Zone inside = detection area.
OCR_FOV_MARGIN = float(os.environ.get("OCR_FOV_MARGIN", "0.1"))
# UNDISTORT=1 nur mit passender Kalibrierung. Default 0 = Rohbild, kein Zoom.
USE_UNDISTORT = os.environ.get("UNDISTORT", "0").lower() in ("1", "true", "yes")

client = genai.Client()


class PartInfo(BaseModel):
    part_type: str
    detected_text: str


class ImageAnalysis(BaseModel):
    parts: list[PartInfo]


mtx = np.array([[7.43979721e+03, 0.00000000e+00, 1.10337352e+03],
                [0.00000000e+00, 7.38832199e+03, 8.10731785e+02],
                [0.00000000e+00, 0.00000000e+00, 1.00000000e+00]])
dist = np.array([[[-0.72200534, -0.08970809, -0.03362853, -0.01038592,  1.48548678]]])

CAMERA_INDEX = int(os.environ.get("OCR_CAMERA", "1"))
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
    cap.set(cv2.CAP_PROP_AUTOFOCUS, 1)
    ret, _ = cap.read()
    if ret:
        print(f"Camera opened at index {idx}")
        break
if not cap or not cap.isOpened():
    print("[FAIL] No camera found. Try: set OCR_CAMERA=0")
    sys.exit(1)

got_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
got_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
print(f"Resolution: {got_w}x{got_h}")

# Unsharp mask — reduziert Blur für bessere OCR
def _sharpen_for_ocr(img):
    gaussian = cv2.GaussianBlur(img, (0, 0), 2.0)
    sharp = cv2.addWeighted(img, 1.3, gaussian, -0.3, 0)
    return np.clip(sharp, 0, 255).astype(np.uint8)

print("Starting camera... Space=OCR | q=quit")
last_result = []

while True:
    ret, frame = cap.read()
    if not ret:
        print("[FAIL] Could not read frame. Camera disconnected?")
        break

    undistorted_frame = cv2.undistort(frame, mtx, dist, None, mtx) if USE_UNDISTORT else frame.copy()
    display = undistorted_frame.copy()
    h, w = display.shape[:2]

    # OCR FOV marker — green zone = position parts here for detection
    m = int(min(w, h) * OCR_FOV_MARGIN / 2) if OCR_FOV_MARGIN > 0 else 0
    x1, y1, x2, y2 = m, m, w - m, h - m
    ocr_roi = undistorted_frame[y1:y2, x1:x2]

    # Darken area outside OCR zone (4 rectangles: top, bottom, left, right)
    overlay = display.copy()
    dark = (40, 40, 40)
    cv2.rectangle(overlay, (0, 0), (w, y1), dark, -1)
    cv2.rectangle(overlay, (0, y2), (w, h), dark, -1)
    cv2.rectangle(overlay, (0, y1), (x1, y2), dark, -1)
    cv2.rectangle(overlay, (x2, y1), (w, y2), dark, -1)
    cv2.addWeighted(overlay, 0.5, display, 0.5, 0, display)

    # Thick green border + label
    cv2.rectangle(display, (x1, y1), (x2, y2), (0, 255, 0), 5)
    cv2.putText(display, "POSITION HERE - OCR ZONE", (x1, max(25, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

    y = 30
    cv2.putText(display, "Space=OCR | q=quit", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    y += 30
    for i, p in enumerate(last_result):
        cv2.putText(display, f"{p.get('part_type', '')}: {p.get('detected_text', '')[:40]}", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        y += 22

    cv2.imshow("Calibrated Part Inspector", display)
    key = cv2.waitKey(1) & 0xFF

    if key == 32:
        print("\nCapturing image and sending to Gemini API...", flush=True)
        sys.stdout.flush()

        ocr_enhanced = _sharpen_for_ocr(ocr_roi)
        rgb_frame = cv2.cvtColor(ocr_enhanced, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(rgb_frame)
        prompt = "Analyze this undistorted image. Identify any objects, parts, or components. Extract and read all visible text, serial numbers, or labels accurately."

        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[pil_image, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ImageAnalysis,
                    temperature=0.0,
                ),
            )
            results = json.loads(response.text)
            parts = results.get("parts", [])
            last_result[:] = parts

            output = "--- OCR & Detection Results ---\n"
            for part in parts:
                output += f"Object Type: {part.get('part_type')}\n"
                output += f"Read Text:   {part.get('detected_text')}\n"
                output += "-" * 30 + "\n"
            print(output, flush=True)
            sys.stdout.flush()

            out_path = ROOT / "ocr_results.txt"
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(output)
                f.write(json.dumps(parts, indent=2, ensure_ascii=False))
        except Exception as e:
            err = f"Error: {e}"
            last_result[:] = [{"part_type": "ERROR", "detected_text": str(e)}]
            print(err, flush=True)
            sys.stdout.flush()
            with open(ROOT / "ocr_results.txt", "w", encoding="utf-8") as f:
                f.write(err)

    elif key == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
