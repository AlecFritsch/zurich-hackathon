"""Gemini Vision tools — multi-mode inspection with structured output."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import threading
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

from config import settings
from pydantic import BaseModel

logger = logging.getLogger(__name__)

_genai_client = None


def _get_client():
    global _genai_client
    if _genai_client is not None:
        return _genai_client
    from google import genai
    _genai_client = genai.Client(api_key=settings.google_api_key)
    return _genai_client


# ---------------------------------------------------------------------------
# Camera — WebSocket primary, ZED 2i secondary, OpenCV fallback
# ---------------------------------------------------------------------------

class Camera:
    """Unified camera interface: WebSocket > ZED 2i SDK > OpenCV."""

    def __init__(self, device_id: int = 0, width: int = 1280, height: int = 720,
                 fps: int = 30, camera_type: str = "websocket",
                 ws_url: str = ""):
        self._device_id = device_id
        self._width = width
        self._height = height
        self._fps = fps
        self._requested_type = camera_type
        self._ws_url = ws_url
        self._backend: str = "none"

        self._zed = None
        self._zed_mat = None
        self._zed_runtime = None
        self._cap: cv2.VideoCapture | None = None

        self._ws_frame: np.ndarray | None = None
        self._ws_lock = threading.Lock()
        self._opencv_lock = threading.Lock()
        self._ws_connected = False
        self._ws_task: asyncio.Task | None = None
        self._ws_stop = False

    def open(self) -> None:
        if self._requested_type == "websocket" and self._ws_url:
            self._backend = "websocket"
            self._ws_connected = False
            host, port = self._parse_ws_url(self._ws_url)
            self._tcp_host = host
            self._tcp_port = port
            logger.info("TCP camera configured — %s:%d (will connect async)", host, port)
            return

        if self._requested_type in ("zed", "websocket"):
            if self._try_open_zed():
                return
            logger.warning("ZED 2i not available — falling back to OpenCV")

        self._try_open_opencv()

    @staticmethod
    def _parse_ws_url(url: str) -> tuple[str, int]:
        """Parse 'ws://host:port' or 'host:port' into (host, port)."""
        url = url.replace("ws://", "").replace("wss://", "").rstrip("/")
        if ":" in url:
            host, port_str = url.rsplit(":", 1)
            return host, int(port_str)
        return url, 5000

    async def start_ws_receiver(self) -> None:
        """Start the background TCP frame receiver. Must be called from async context."""
        if self._backend != "websocket":
            return
        self._ws_stop = False
        self._ws_task = asyncio.create_task(self._tcp_receive_loop())
        logger.info("TCP camera receiver started")

    async def _tcp_receive_loop(self) -> None:
        """Background loop: connects to ZED PC via raw TCP socket, reads framed JPEGs.

        Protocol: 8-byte unsigned long long (Q) = payload size, then payload = JPEG bytes.
        """
        import struct
        import socket as _socket

        payload_header_size = struct.calcsize("Q")

        while not self._ws_stop:
            sock = None
            try:
                sock = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
                sock.settimeout(5.0)

                logger.info("TCP camera connecting to %s:%d ...", self._tcp_host, self._tcp_port)
                await asyncio.to_thread(sock.connect, (self._tcp_host, self._tcp_port))
                sock.settimeout(10.0)

                self._ws_connected = True
                logger.info("TCP camera connected to %s:%d", self._tcp_host, self._tcp_port)

                buf = b""

                while not self._ws_stop:
                    while len(buf) < payload_header_size:
                        chunk = await asyncio.to_thread(sock.recv, 4096)
                        if not chunk:
                            raise ConnectionError("Connection closed by remote")
                        buf += chunk

                    msg_size = struct.unpack("Q", buf[:payload_header_size])[0]
                    buf = buf[payload_header_size:]

                    while len(buf) < msg_size:
                        chunk = await asyncio.to_thread(sock.recv, min(65536, msg_size - len(buf)))
                        if not chunk:
                            raise ConnectionError("Connection closed during frame read")
                        buf += chunk

                    frame_data = buf[:msg_size]
                    buf = buf[msg_size:]

                    arr = np.frombuffer(frame_data, dtype=np.uint8)
                    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if frame is not None:
                        with self._ws_lock:
                            self._ws_frame = frame

            except Exception as e:
                self._ws_connected = False
                if not self._ws_stop:
                    logger.warning("TCP camera disconnected: %s — reconnecting in 2s", e)
                    await asyncio.sleep(2)
            finally:
                if sock:
                    try:
                        sock.close()
                    except Exception:
                        pass

    def _try_open_zed(self) -> bool:
        try:
            import pyzed.sl as sl

            zed = sl.Camera()
            init_params = sl.InitParameters()
            init_params.camera_resolution = sl.RESOLUTION.HD1080
            init_params.camera_fps = self._fps
            init_params.depth_mode = sl.DEPTH_MODE.NONE

            err = zed.open(init_params)
            if err != sl.ERROR_CODE.SUCCESS:
                logger.warning("ZED open failed: %s", err)
                return False

            self._zed = zed
            self._zed_mat = sl.Mat()
            self._zed_runtime = sl.RuntimeParameters()
            self._backend = "zed"
            logger.info("ZED 2i camera opened — %dx%d @ %dfps", self._width, self._height, self._fps)
            return True
        except ImportError:
            logger.info("pyzed SDK not installed — ZED not available")
            return False
        except Exception as e:
            logger.warning("ZED init error: %s", e)
            return False

    def _try_open_opencv(self) -> None:
        import sys
        # Nur konfigurierte Kamera (kein Fallback auf Webcam). CAMERA_DEVICE_ID=0 = externe, 1 = Webcam
        apis = [cv2.CAP_DSHOW, cv2.CAP_MSMF] if sys.platform == "win32" else [cv2.CAP_ANY]
        for api in apis:
            try:
                self._cap = cv2.VideoCapture(self._device_id, api)
            except Exception as e:
                logger.debug("VideoCapture(%d, %s) failed: %s", self._device_id, api, e)
                continue
            if self._cap.isOpened():
                ret, _ = self._cap.read()
                if ret:
                    try:
                        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self._width)
                        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self._height)
                    except Exception:
                        pass
                    self._backend = "opencv"
                    api_name = "DSHOW" if api == cv2.CAP_DSHOW else "MSMF" if api == cv2.CAP_MSMF else str(api)
                    logger.info("OpenCV camera opened — device %d (api=%s)", self._device_id, api_name)
                    return
            try:
                self._cap.release()
            except Exception:
                pass
            self._cap = None
        self._backend = "none"
        logger.warning("No camera at device %d — set CAMERA_DEVICE_ID=0 or 1 in havoc/.env", self._device_id)

    def is_open(self) -> bool:
        if self._backend == "websocket":
            return self._ws_connected or self._ws_frame is not None
        if self._backend == "zed":
            return self._zed is not None and self._zed.is_opened()
        if self._backend == "opencv":
            return self._cap is not None and self._cap.isOpened()
        return False

    def _grab_ws_frame(self) -> Any | None:
        with self._ws_lock:
            return self._ws_frame.copy() if self._ws_frame is not None else None

    def _grab_zed_frame(self) -> Any | None:
        import pyzed.sl as sl
        if self._zed.grab(self._zed_runtime) == sl.ERROR_CODE.SUCCESS:
            self._zed.retrieve_image(self._zed_mat, sl.VIEW.LEFT)
            bgra = self._zed_mat.get_data()
            return cv2.cvtColor(bgra, cv2.COLOR_BGRA2BGR)
        return None

    def _grab_opencv_frame(self) -> Any | None:
        with self._opencv_lock:
            return self._grab_opencv_frame_impl()

    def _grab_opencv_frame_impl(self) -> Any | None:
        if not self._cap or not self._cap.isOpened():
            return None
        try:
            ret, frame = self._cap.read()
        except Exception as e:
            logger.warning("OpenCV read failed (camera busy? close other apps): %s", e)
            try:
                self._cap.release()
                self._cap = None
            except Exception:
                pass
            self._try_open_opencv()
            return None
        if not ret or frame is None:
            return None
        try:
            h, w = frame.shape[:2]
            if w > h * 2.5:
                frame = frame[:, : w // 2]
        except Exception:
            return None
        return frame

    def _grab_frame(self) -> Any | None:
        if self._backend == "websocket":
            return self._grab_ws_frame()
        if self._backend == "zed":
            return self._grab_zed_frame()
        return self._grab_opencv_frame()

    def capture(self) -> Image.Image | None:
        frame = self._grab_frame()
        if frame is None:
            return None
        frame = undistort_frame(frame)
        return Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

    def capture_base64(self) -> str | None:
        try:
            frame = self._grab_frame()
            if frame is None:
                return None
            try:
                frame = undistort_frame(frame)
            except Exception as e:
                logger.debug("undistort skipped: %s", e)
            _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if buffer is None:
                return None
            return base64.b64encode(buffer.tobytes()).decode("utf-8")
        except Exception as e:
            logger.warning("capture_base64 failed: %s", e)
            return None

    def release(self) -> None:
        self._ws_stop = True
        if self._ws_task and not self._ws_task.done():
            self._ws_task.cancel()
        if self._backend == "zed" and self._zed:
            self._zed.close()
            self._zed = None
        if self._cap:
            self._cap.release()
            self._cap = None
        self._backend = "none"


# ---------------------------------------------------------------------------
# Calibration & OCR
# ---------------------------------------------------------------------------

_calib_mtx = None
_calib_dist = None


def load_calibration(path: str | None = None) -> tuple[np.ndarray | None, np.ndarray | None]:
    """Load camera matrix and distortion from .npz or camera_calibration.json."""
    global _calib_mtx, _calib_dist
    if _calib_mtx is not None:
        return _calib_mtx, _calib_dist
    p = path or settings.calibration_path
    if not p:
        for name in ("usb_camera_intrinsics.npz", "camera_calibration.json"):
            for base in (Path.cwd(), Path(__file__).resolve().parent.parent.parent):
                fp = base / name
                if fp.exists():
                    p = str(fp)
                    break
        if not p:
            return None, None
    fp = Path(p)
    if not fp.exists():
        return None, None
    try:
        if fp.suffix == ".npz":
            data = np.load(fp)
            _calib_mtx, _calib_dist = data["mtx"], data["dist"]
        else:
            with open(fp, encoding="utf-8") as f:
                data = json.load(f)
            _calib_mtx = np.array(data["camera_matrix"])
            d = data.get("distortion_coefficients", data.get("distortion", []))
            _calib_dist = np.array(d) if isinstance(d, list) else np.array(d)
        logger.info("Calibration loaded from %s", fp)
        return _calib_mtx, _calib_dist
    except Exception as e:
        logger.warning("Calibration load failed: %s", e)
        return None, None


def undistort_frame(frame: np.ndarray) -> np.ndarray:
    """Apply calibration to remove lens distortion."""
    mtx, dist = load_calibration()
    if mtx is None or dist is None:
        return frame
    return cv2.undistort(frame, mtx, dist, None, mtx)


class _PartInfo(BaseModel):
    part_type: str
    detected_text: str


class _ImageAnalysis(BaseModel):
    parts: list[_PartInfo]


async def run_ocr(camera: "Camera", prompt: str | None = None) -> dict[str, Any]:
    """Capture frame, undistort, run Gemini OCR. Returns {parts: [{part_type, detected_text}]}."""
    from google.genai import types

    frame = camera._grab_frame() if hasattr(camera, "_grab_frame") else None
    if frame is None:
        return {"parts": [], "error": "No frame"}

    frame = undistort_frame(frame)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)

    client = _get_client()
    prompt = prompt or "Identify objects, parts, components. Extract all visible text, serial numbers, labels."
    try:
        response = client.models.generate_content(
            model=settings.gemini_vision_model,
            contents=[pil_img, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_ImageAnalysis,
                temperature=0.0,
            ),
        )
        data = json.loads(response.text)
        return {"parts": [{"part_type": p["part_type"], "detected_text": p["detected_text"]} for p in data.get("parts", [])]}
    except Exception as e:
        logger.error("OCR failed: %s", e)
        return {"parts": [], "error": str(e)}


def verify_components_visible(image: Image.Image, expected_parts: list[str]) -> dict[str, Any]:
    """Component Verification — check if expected parts are visible in image. Returns {available, missing, message}."""
    if not expected_parts:
        return {"available": True, "missing": [], "message": "No parts to verify"}
    client = _get_client()
    parts_str = ", ".join(expected_parts)
    prompt = f"""Look at this factory/workstation image. Expected components: [{parts_str}].
List which of these are VISIBLE in the image. Return JSON: {{"visible": ["part1", "part2"], "missing": ["part3"]}}.
Be strict: only list as visible if you clearly see the component."""
    try:
        from google.genai import types
        response = client.models.generate_content(
            model=settings.gemini_vision_model,
            contents=[image, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
            ),
        )
        data = json.loads(response.text)
        visible = set(data.get("visible", []))
        missing = [p for p in expected_parts if p not in visible]
        return {
            "available": len(missing) == 0,
            "missing": missing,
            "message": "All components available" if not missing else f"Missing: {', '.join(missing)}",
        }
    except Exception as e:
        logger.warning("Verify failed: %s", e)
        return {"available": True, "missing": [], "message": f"Verify skipped: {e}"}
