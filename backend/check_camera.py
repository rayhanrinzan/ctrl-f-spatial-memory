"""Open the webcam on the main thread once. On macOS this triggers the camera-permission
prompt for your terminal app (the server's background thread cannot show it)."""
import os
import sys

import cv2

index = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.getenv("CTRLF_CAMERA_INDEX", "0"))
cap = cv2.VideoCapture(index)
ok, frame = cap.read() if cap.isOpened() else (False, None)
cap.release()
if ok:
    print(f"Camera {index} OK: {frame.shape[1]}x{frame.shape[0]}")
else:
    print(f"Camera {index} unavailable. Grant camera access to your terminal in System Settings > "
          "Privacy & Security > Camera, then restart the terminal and try again.")
    sys.exit(1)
