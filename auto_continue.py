#!/usr/bin/env python3
import time
import pyautogui
import sys

# Configuration
TARGET = (571, 793)# Using negative Y coordinate (common in multi-monitor setups)
INTERVAL = 300        # 5 minutes
pyautogui.PAUSE = 0.1

# Disable PyAutoGUI fail-safe to prevent interruption
pyautogui.FAILSAFE = False

def validate_coordinates(x, y):
    """Validate that coordinates are within reasonable bounds (allow negative Y for multi-monitor setups)"""
    screen_width, screen_height = pyautogui.size()
    
    # Allow negative Y coordinates (common in multi-monitor setups)
    if x < 0 or x >= screen_width:
        raise ValueError(f"X coordinate ({x}) is outside screen bounds (0-{screen_width})")
    
    # For Y, allow negative vacontinuelues but warn if they seem unreasonable
    if y < -1000 or y > screen_height + 1000:
        raise ValueError(f"Y coordinate ({y}) seems unreasonable (should be between -1000 and {screen_height + 1000})")
    
    if y < 0:
        print(f"⚠️  Warning: Using negative Y coordinate ({y}). This is common in multi-monitor setups.")
    
    return True

def main():
    print("Auto-continue script started")
    print(f"Target coordinates: {TARGET}")
    print(f"Interval: {INTERVAL} seconds ({INTERVAL/60:.1f} minutes)")
    print("Press Ctrl+C to stop")
    
    # Validate coordinates before starting
    try:
        validate_coordinates(*TARGET)
        print(f"✓ Coordinates validated successfully")
    except ValueError as e:
        print(f"✗ {e}")
        print("Please update TARGET coordinates with valid screen coordinates")
        print("You can get current mouse position with: pyautogui.position()")
        sys.exit(1)
    
    try:
        while True:
            print(f"[{time.strftime('%H:%M:%S')}] Sending 'continue' command...")
            
            # Move to target position and click
            pyautogui.moveTo(*TARGET, duration=0.4)
            pyautogui.click()
            
            # Type "continue" with slight delays between characters
            pyautogui.typewrite("continue to make sure everything in exhaustive endpoint point verification summary all runs.", interval=0.03)
            pyautogui.press("enter")
            
            print(f"[{time.strftime('%H:%M:%S')}] Command sent. Sleeping for {INTERVAL} seconds...")
            time.sleep(INTERVAL)
            
    except KeyboardInterrupt:
        print("\n[INFO] Script stopped by user (Ctrl+C)")
        sys.exit(0)
    except pyautogui.FailSafeException:
        print("\n[ERROR] PyAutoGUI fail-safe triggered. Mouse moved to corner of screen.")
        print("This can happen if you move the mouse to the top-left corner during execution.")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
