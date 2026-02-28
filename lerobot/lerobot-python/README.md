## Python wrapper for lerobot SO101

To determine the robot port:

```shell
uv run lerobot-find-port
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