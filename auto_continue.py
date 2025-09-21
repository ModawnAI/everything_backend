#!/usr/bin/env python3
import time
import pyautogui
import sys

# Configuration
TARGET = (1275, -203) # replace with your x, y from pyautogui.position()
INTERVAL = 600        # 5 minutes
pyautogui.PAUSE = 0.1

def main():
    print("Auto-continue script started")
    print(f"Target coordinates: {TARGET}")
    print(f"Interval: {INTERVAL} seconds ({INTERVAL/60:.1f} minutes)")
    print("Press Ctrl+C to stop")
    
    try:
        while True:
            print(f"[{time.strftime('%H:%M:%S')}] Sending 'continue' command...")
            
            # Move to target position and click
            pyautogui.moveTo(*TARGET, duration=0.4)
            pyautogui.click()
            
            # Type "continue" with slight delays between characters
            pyautogui.typewrite("ccontinue", interval=0.03)
            pyautogui.press("enter")
            
            print(f"[{time.strftime('%H:%M:%S')}] Command sent. Sleeping for {INTERVAL} seconds...")
            time.sleep(INTERVAL)
            
    except KeyboardInterrupt:
        print("\n[INFO] Script stopped by user (Ctrl+C)")
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
