#!/usr/bin/env python3
import subprocess
import sys
import os

def install_package(package):
    """Install a package using pip"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", package])
        print(f"✅ Successfully installed {package}")
        return True
    except subprocess.CalledProcessError:
        print(f"❌ Failed to install {package}")
        return False

def main():
    print("Setting up auto-continue script...")
    print("This will install pyautogui and pillow packages")
    
    packages = ["pyautogui", "pillow"]
    all_installed = True
    
    for package in packages:
        if not install_package(package):
            all_installed = False
    
    if all_installed:
        print("\n✅ All packages installed successfully!")
        print("\nNext steps:")
        print("1. Grant Terminal accessibility permissions:")
        print("   - Go to System Settings → Privacy & Security → Accessibility")
        print("   - Add Terminal to the list")
        print("2. Grant screen recording permissions:")
        print("   - Go to System Settings → Privacy & Security → Screen Recording")
        print("   - Add Terminal to the list")
        print("3. Find target coordinates:")
        print("   - Run: python3 find_coordinates.py")
        print("   - Move cursor to your IDE's text field")
        print("   - Press Ctrl+C to get coordinates")
        print("4. Update coordinates in auto_continue.py")
        print("5. Run the script: python3 auto_continue.py")
    else:
        print("\n❌ Some packages failed to install. Please install manually:")
        print("pip install --user pyautogui pillow")

if __name__ == "__main__":
    main()
