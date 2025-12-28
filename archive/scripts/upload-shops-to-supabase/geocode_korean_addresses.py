#!/usr/bin/env python3
"""
Geocode Korean addresses using Kakao Maps API
"""

import csv
import requests
import time
import os
from typing import Dict, Optional, Tuple

# Get API key from environment variable
KAKAO_API_KEY = os.getenv('KAKAO_API_KEY', '')

def geocode_address_kakao(address: str) -> Optional[Tuple[float, float]]:
    """
    Geocode a Korean address using Kakao Maps API

    Args:
        address: Korean address string

    Returns:
        Tuple of (latitude, longitude) or None if geocoding fails
    """
    if not KAKAO_API_KEY:
        raise ValueError("KAKAO_API_KEY environment variable not set")

    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_API_KEY}"}
    params = {"query": address}

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()

        data = response.json()

        if data.get('documents') and len(data['documents']) > 0:
            # Get first result
            result = data['documents'][0]

            # Kakao returns x (longitude) and y (latitude)
            lon = float(result.get('x', 0))
            lat = float(result.get('y', 0))

            return (lat, lon)
        else:
            print(f"No results found for: {address}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Error geocoding {address}: {e}")
        return None

def geocode_address_google(address: str) -> Optional[Tuple[float, float]]:
    """
    Geocode address using Google Geocoding API (alternative method)

    Args:
        address: Address string

    Returns:
        Tuple of (latitude, longitude) or None if geocoding fails
    """
    google_api_key = os.getenv('GOOGLE_MAPS_API_KEY', '')

    if not google_api_key:
        raise ValueError("GOOGLE_MAPS_API_KEY environment variable not set")

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": address,
        "key": google_api_key,
        "region": "kr"  # Bias towards Korean results
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()

        data = response.json()

        if data.get('status') == 'OK' and data.get('results'):
            location = data['results'][0]['geometry']['location']
            return (location['lat'], location['lng'])
        else:
            print(f"Google API: {data.get('status')} for {address}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Error geocoding with Google {address}: {e}")
        return None

def process_csv(input_file: str, output_file: str, use_google: bool = False):
    """
    Process CSV file and add lat/lon columns

    Args:
        input_file: Path to input CSV file
        output_file: Path to output CSV file
        use_google: If True, use Google API instead of Kakao
    """
    geocode_func = geocode_address_google if use_google else geocode_address_kakao
    api_name = "Google" if use_google else "Kakao"

    print(f"Using {api_name} Maps API for geocoding...")

    rows_processed = 0
    rows_geocoded = 0

    with open(input_file, 'r', encoding='utf-8') as infile, \
         open(output_file, 'w', encoding='utf-8', newline='') as outfile:

        reader = csv.DictReader(infile)

        # Add lat/lon columns to fieldnames
        fieldnames = reader.fieldnames + ['LATITUDE', 'LONGITUDE']
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            rows_processed += 1
            address = row.get('ADDRESS', '').strip()

            if address:
                print(f"\nProcessing {rows_processed}: {row.get('SHOP_NAME', 'Unknown')}")
                print(f"Address: {address}")

                coords = geocode_func(address)

                if coords:
                    lat, lon = coords
                    row['LATITUDE'] = lat
                    row['LONGITUDE'] = lon
                    rows_geocoded += 1
                    print(f"✓ Geocoded: {lat}, {lon}")
                else:
                    row['LATITUDE'] = ''
                    row['LONGITUDE'] = ''
                    print(f"✗ Failed to geocode")

                # Rate limiting - be respectful to the API
                time.sleep(0.1)  # 100ms delay between requests
            else:
                row['LATITUDE'] = ''
                row['LONGITUDE'] = ''

            writer.writerow(row)

    print(f"\n{'='*60}")
    print(f"Geocoding complete!")
    print(f"Total rows: {rows_processed}")
    print(f"Successfully geocoded: {rows_geocoded}")
    print(f"Failed: {rows_processed - rows_geocoded}")
    print(f"Output file: {output_file}")
    print(f"{'='*60}")

if __name__ == "__main__":
    import sys

    input_csv = "shop.csv"
    output_csv = "shop_with_coordinates.csv"

    # Check if using Google API
    use_google = '--google' in sys.argv

    if not os.path.exists(input_csv):
        print(f"Error: {input_csv} not found!")
        sys.exit(1)

    try:
        process_csv(input_csv, output_csv, use_google=use_google)
    except ValueError as e:
        print(f"\nError: {e}")
        print("\nTo use this script, you need to set an API key:")
        print("\nFor Kakao Maps API (Recommended for Korean addresses):")
        print("  1. Get API key from: https://developers.kakao.com/")
        print("  2. Set environment variable: export KAKAO_API_KEY='your_key_here'")
        print("\nFor Google Maps API:")
        print("  1. Get API key from: https://console.cloud.google.com/")
        print("  2. Set environment variable: export GOOGLE_MAPS_API_KEY='your_key_here'")
        print("  3. Run with: python geocode_korean_addresses.py --google")
        sys.exit(1)
