#!/usr/bin/env python3
import pyautogui
import time

print("Move your cursor to the text field where you want to send 'continue' commands")
print("Press Ctrl+C to stop and get the coordinates")
print("The script will print coordinates every second...")

try:
    while True:
        x, y = pyautogui.position()
        print(f"Current position: ({x}, {y}) - Move to your target and press Ctrl+C")
        time.sleep(1)
except KeyboardInterrupt:
    x, y = pyautogui.position()
    print(f"\nFinal coordinates: ({x}, {y})")
    print(f"Copy this line to replace TARGET in auto_continue.py:")
    print(f"TARGET = ({x}, {y})  # replace with your x, y from pyautogui.position()")
