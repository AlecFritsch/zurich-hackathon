# Scripts

Standalone utilities for camera and OCR. Run from project root: `python scripts/ocr.py`

| Script | Usage |
|--------|-------|
| `ocr.py` | Live OCR — Space=run, q=quit. Results → `ocr_results.txt` |
| `calibration.py` | Checkerboard calibration → `usb_camera_intrinsics.npz` |
| `camera_preview.py` | Live camera preview |

**Env:** `OCR_CAMERA=1` / `CALIBRATION_CAMERA=1` | `OCR_FOV_MARGIN=0.1` (center crop margin, 0=full frame).
