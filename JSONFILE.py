import cv2
import os
import json
import numpy as np
from dotenv import load_dotenv
from PIL import Image
from google import genai
from google.genai import types
from pydantic import BaseModel

# 1. Load environment variables
load_dotenv()
client = genai.Client()

# 2. Define the new structured output to match your sequence JSON
class RobotAction(BaseModel):
    PHASE: int
    PART_ID: str
    ACTION: str
    TARGET_LOCATION: str
    TOOL: str

class RobotSequence(BaseModel):
    sequence: list[RobotAction]

# 3. Apply your Calibration Parameters
mtx = np.array([[7.43979721e+03, 0.00000000e+00, 1.10337352e+03],
                [0.00000000e+00, 7.38832199e+03, 8.10731785e+02],
                [0.00000000e+00, 0.00000000e+00, 1.00000000e+00]])

dist = np.array([[[-0.72200534, -0.08970809, -0.03362853, -0.01038592,  1.48548678]]])

# 4. Initialize Camera
cap = cv2.VideoCapture(4)

print("Starting camera... Press 'Space' to run OCR & generate JSON, or 'q' to quit.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # 1. Undistort the frame
    undistorted_frame = cv2.undistort(frame, mtx, dist, None, mtx)
    height, width, _ = undistorted_frame.shape
    mid_x = width // 2

    # 2. Create a display copy and draw a vertical line down the middle
    display_frame = undistorted_frame.copy()
    cv2.line(display_frame, (mid_x, 0), (mid_x, height), (0, 255, 0), 2) # Green line, 2px thick
    
    cv2.imshow("Calibrated Part Inspector", display_frame)
    key = cv2.waitKey(1) & 0xFF

    # 3. Trigger sequence generation on Spacebar
    if key == 32: 
        print("\nCapturing image, slicing left/right, and generating sequence...")
        
        # We use the original undistorted_frame so the green line doesn't confuse the AI
        rgb_frame = cv2.cvtColor(undistorted_frame, cv2.COLOR_BGR2RGB)
        
        # Slice the image into 2 halves (Left and Right)
        tiles = [
            rgb_frame[0:height, 0:mid_x-2],     # Left half
            rgb_frame[0:height, mid_x-2:width]  # Right half
        ]

        master_sequence = []
        
        prompt = """
        Analyze this cropped image segment carefully. There may be many manufacturing parts or labels here.
        You MUST extract the exact text of EVERY SINGLE part number or label you see (e.g., SY30M-..., EX260-...).
        Do not skip any parts.
        
        For each distinct part or label:
        - Set 'PART_ID' to the exact part number/label.
        - Set 'ACTION' to "PICK_AND_PLACE".
        - Set 'TOOL' to "GRIPPER".
        - Set 'PHASE' incrementally.
        - Set 'TARGET_LOCATION' to a logical placeholder like "Station X" or "TBD".
        """
        
        try:
            tile_names = ["Left Half", "Right Half"]
            for i, tile_array in enumerate(tiles):
                print(f"Processing {tile_names[i]}...")
                pil_image = Image.fromarray(tile_array)
                
                response = client.models.generate_content(
                    model='gemini-2.5-flash', 
                    contents=[pil_image, prompt],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=RobotSequence,
                        temperature=0.0 # Force determinism
                    ),
                )
                
                results = json.loads(response.text)
                sequence_data = results.get('sequence', [])
                
                master_sequence.extend(sequence_data)
                print(f" -> Found {len(sequence_data)} parts in this half.")

            print("\n--- Final Master Sequence ---")
            print(f"Total parts detected: {len(master_sequence)}")
            
            output_filename = "generated_robot_sequence.json"
            with open(output_filename, 'w') as f:
                json.dump(master_sequence, f, indent=2)
                
            print(f"✅ Full sequence successfully saved to '{output_filename}'")
                
        except Exception as e:
            print(f"Error during API call: {e}")

    elif key == ord('q'):
        break
cap.release()
cv2.destroyAllWindows()