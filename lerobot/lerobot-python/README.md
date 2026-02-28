## Python wrapper for lerobot SO101

To determine the robot port:

```shell
uv run lerobot-find-port
```

Add permissions for the port:

```shell
sudo chmod 666 /dev/<port>
```

To run the controller example (change port and paths):

```shell
uv run robot_controller.py
```

To use within python:

```python
from robot_controller import RobotController

with RobotController("/dev/ttyACM0", "/path/to/calibration") as controller:
    ...
```

## Robot Bridge (Remote-Steuerung)

Für Havoc auf anderem Laptop — REST API starten:

```shell
uv run python robot_bridge.py
```

Server läuft auf Port 9000. Havoc verbindet sich per `LEROBOT_BRIDGE_URL`.

```