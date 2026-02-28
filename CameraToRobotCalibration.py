import cv2
import time
import numpy as np
import pinocchio as pin

# ==========================================
# 1. CONFIGURATION
# ==========================================
CAMERA_INDEX = 4
MARKER_SIZE = 0.05  # 50mm marker
REQUIRED_POINTS = 5 # Minimum 4 points needed, 5 is safer

# --- HARDCODED CAMERA INTRINSICS ---
camera_matrix = np.array([
    [7.43979721e+03, 0.00000000e+00, 1.10337352e+03],
    [0.00000000e+00, 7.38832199e+03, 8.10731785e+02],
    [0.00000000e+00, 0.00000000e+00, 1.00000000e+00]
], dtype=np.float64)

dist_coeffs = np.array([
    [-0.72200534, -0.08970809, -0.03362853, -0.01038592, 1.48548678]
], dtype=np.float64)

# ==========================================
# 2. SO-ARM100 KINEMATICS SETUP
# ==========================================
# TODO: UPDATE THIS PATH!
URDF_PATH = "/path/to/lerobot/configs/so_arm100.urdf" 
EE_FRAME_NAME = "gripper_link" 

print(f"Loading SO-ARM100 URDF...")
model = pin.buildModelFromUrdf(URDF_PATH)
data = model.createData()
ee_frame_id = model.getFrameId(EE_FRAME_NAME)

# TODO: Initialize your specific LeRobot arm instance here
# Example: arm = YourLeRobotArmClass(...)
# arm.connect()

def get_robot_tip_position():
    """
    Reads the SO-ARM100 joint angles, calculates forward kinematics, 
    and returns the exact [X, Y, Z] coordinate.
    """
    # --- GET JOINT ANGLES ---
    # TODO: Replace the line below with your actual LeRobot read command
    # observation = arm.read()
    # joint_angles = observation['state']
    
    # DUMMY ANGLES FOR TESTING (Remove this and use the live data above)
    joint_angles = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0] 
    
    # Extract only the main arm joints (ignoring the gripper jaw state if it's there)
    q = np.array(joint_angles[:model.nq]) 

    # --- COMPUTE KINEMATICS ---
    pin.forwardKinematics(model, data, q)
    pin.updateFramePlacements(model, data)

    # Extract the 3D translation vector (X, Y, Z in meters)
    tip_position = data.oMf[ee_frame_id].translation
    return tip_position

# ==========================================
# 3. SETUP ARUCO & CAMERA
# ==========================================
aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
parameters = cv2.aruco.DetectorParameters()
detector = cv2.aruco.ArucoDetector(aruco_dict, parameters)

# Define 3D corners of the marker to calculate its center
half_size = MARKER_SIZE / 2.0
obj_points = np.array([
    [-half_size,  half_size, 0],
    [ half_size,  half_size, 0],
    [ half_size, -half_size, 0],
    [-half_size, -half_size, 0]
], dtype=np.float32)

cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_V4L2)
cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

points_cam = []
points_robot = []

print("\n--- TOUCH CALIBRATION STARTED ---")
print("1. Place the marker flat on the table.")
print("2. Move the robot wrist/gripper to physically touch the CENTER of the marker.")
print("3. Ensure the OpenCV window is selected, then press 'c' to capture.")
print(f"We need {REQUIRED_POINTS} points. Spread them out across the workspace!")

try:
    while len(points_cam) < REQUIRED_POINTS:
        ret, frame = cap.read()
        if not ret: break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        corners, ids, rejected = detector.detectMarkers(gray)
        
        marker_tvec = None

        if ids is not None and 2 in ids:
            idx = np.where(ids == 2)[0][0]
            marker_corners = corners[idx][0]
            
            # Calculate pose
            success, rvec, tvec = cv2.solvePnP(obj_points, marker_corners, camera_matrix, dist_coeffs)

            if success:
                marker_tvec = tvec.flatten() # [X, Y, Z] of the marker relative to camera
                
                cv2.aruco.drawDetectedMarkers(frame, corners, ids)
                cv2.drawFrameAxes(frame, camera_matrix, dist_coeffs, rvec, tvec, MARKER_SIZE)
                
                text = f"Cam X:{marker_tvec[0]:.3f} Y:{marker_tvec[1]:.3f} Z:{marker_tvec[2]:.3f}"
                cv2.putText(frame, text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                cv2.putText(frame, "READY: TOUCH MARKER & PRESS 'C'", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        cv2.putText(frame, f"Captured: {len(points_cam)}/{REQUIRED_POINTS}", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
        cv2.imshow("Touch Calibration", frame)
        
        key = cv2.waitKey(1) & 0xFF

        # --- CAPTURE LOGIC ---
        if key == ord('c'):
            if marker_tvec is not None:
                robot_pos = get_robot_tip_position()
                
                points_cam.append(marker_tvec)
                points_robot.append(robot_pos)
                
                print(f"\n✅ Point {len(points_cam)} captured!")
                print(f"   Camera saw marker at:  [{marker_tvec[0]:.4f}, {marker_tvec[1]:.4f}, {marker_tvec[2]:.4f}]")
                print(f"   Robot was touching at: [{robot_pos[0]:.4f}, {robot_pos[1]:.4f}, {robot_pos[2]:.4f}]")
                
                time.sleep(1.0) # Debounce to prevent accidental double-clicks
            else:
                print("\n❌ Cannot capture. Marker ID 2 is not clearly visible.")
                
        elif key == ord('q'):
            print("\nExiting early...")
            break

finally:
    cap.release()
    cv2.destroyAllWindows()

# ==========================================
# 4. CALCULATE 3D TRANSFORMATION
# ==========================================
if len(points_cam) >= 4:
    print("\nCalculating 3D Transformation Matrix...")
    
    pts_cam_np = np.array(points_cam, dtype=np.float64)
    pts_robot_np = np.array(points_robot, dtype=np.float64)
    
    # Calculate the Affine transform (Rotation + Translation) mapping Camera -> Robot
    retval, affine_matrix, inliers = cv2.estimateAffine3D(pts_cam_np, pts_robot_np)
    
    if retval:
        # Convert the 3x4 affine matrix into a standard 4x4 Transformation Matrix
        T_cam_to_robot = np.vstack((affine_matrix, [0, 0, 0, 1]))
        
        print("\n================ CALIBRATION SUCCESSFUL ================")
        print("4x4 Transformation Matrix (Camera to Robot Base):\n")
        print(np.round(T_cam_to_robot, 4))
        
        np.save("cam_to_robot_transform.npy", T_cam_to_robot)
        print("\n💾 Matrix successfully saved to 'cam_to_robot_transform.npy'")
        print("========================================================")
    else:
        print("\n❌ Math failed to converge. Make sure your points are not in a straight line.")
else:
    print(f"\n⚠️ Not enough points to calculate. Need at least 4, got {len(points_cam)}.")