from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    google_api_key: str = ""
    gemini_model: str = "gemini-3.1-pro-preview"
    gemini_orchestrator_model: str = "gemini-robotics-er-1.5-preview"  # Robotics-ER: embodied reasoning, function calling
    gemini_vision_model: str = "gemini-3.1-pro-preview"

    dobot_host: str = "192.168.1.6"
    dobot_port: int = 29999

    # Lerobot Remote (Robot Bridge in WSL auf diesem Rechner)
    robot_type: str = "lerobot_remote"  # "lerobot_remote" | "dobot"
    lerobot_bridge_url: str = "http://localhost:9000"

    camera_type: str = "opencv"  # "opencv" | "websocket"
    camera_ws_url: str = ""
    camera_device_id: int = 0
    camera_width: int = 1280
    camera_height: int = 720
    camera_fps: int = 30
    calibration_path: str = ""  # usb_camera_intrinsics.npz or camera_calibration.json
    cam_to_robot_transform_path: str = ""  # cam_to_robot_transform.npy (ArUco calibration)

    sqlite_path: str = "events.db"
    documents_dir: Path = Path("documents")

    confidence_high: float = 0.7
    confidence_low: float = 0.3

    max_speed_pct: int = 100
    backend_port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
