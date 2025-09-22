#!/usr/bin/env python3
import time
import pyautogui
import sys

# Configuration
TARGET = (1766, -223)# Using negative Y coordinate (common in multi-monitor setups)
INTERVAL = 300        # 5 minutes
pyautogui.PAUSE = 0.1

# Disable PyAutoGUI fail-safe to prevent interruption
pyautogui.FAILSAFE = False

def validate_coordinates(x, y):
    """Validate that coordinates are within reasonable bounds (allow multi-monitor setups)"""
    screen_width, screen_height = pyautogui.size()
    
    # For multi-monitor setups, allow coordinates beyond primary screen
    # Extend the valid range to accommodate secondary monitors
    max_x = screen_width * 3  # Allow up to 3 monitors horizontally
    max_y = screen_height * 2  # Allow up to 2 monitors vertically
    
    if x < -screen_width or x >= max_x:
        raise ValueError(f"X coordinate ({x}) is outside reasonable bounds (-{screen_width} to {max_x})")
    
    # For Y, allow negative values and extended range for multi-monitor setups
    if y < -screen_height or y > max_y:
        raise ValueError(f"Y coordinate ({y}) is outside reasonable bounds (-{screen_height} to {max_y})")
    
    if x >= screen_width:
        print(f"⚠️  Using X coordinate ({x}) beyond primary screen ({screen_width}). Multi-monitor setup detected.")
    
    if y < 0:
        print(f"⚠️  Using negative Y coordinate ({y}). Multi-monitor setup detected.")
    
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
            pyautogui.typewrite("continue", interval=0.03)
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
