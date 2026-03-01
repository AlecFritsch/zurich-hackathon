# Scripts

| Script | Usage |
|--------|-------|
| `start.ps1` | **Alles starten:** Robot Bridge (WSL) + Havoc. Von Projektroot: `.\scripts\start.ps1` |
| `calibration.py` | Checkerboard calibration → `usb_camera_intrinsics.npz` |
| `camera_robot_calibration.py` | ArUco Touch: Kamera ↔ Roboter → `cam_to_robot_transform.npy` |

**Env:** `CALIBRATION_CAMERA=0` oder `1` | `LEROBOT_BRIDGE_URL` für live Joint-Winkel.
