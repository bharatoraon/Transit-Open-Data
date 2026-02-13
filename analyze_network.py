#!/usr/bin/env python3
"""
Enhanced travel time calculator - compute times for ANY station pair.
"""

import csv
import json
from pathlib import Path
from collections import defaultdict

# Paths
GTFS_DIR = Path(__file__).parent / "GTFS" / "CMRL"
OUTPUT_DIR = Path(__file__).parent / "client" / "public" / "data"

def read_csv(filepath):
    """Read a CSV file and return list of dictionaries."""
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)

def build_travel_time_matrix():
    """Build a complete travel time matrix for all station pairs."""
    print("Building complete travel time matrix...")
    
    stop_times = read_csv(GTFS_DIR / "stop_times.txt")
    stops = read_csv(GTFS_DIR / "stops.txt")
    
    # Create stop name lookup
    stop_names = {}
    for stop in stops:
        stop_names[stop['stop_id']] = stop['stop_name']
    
    # Group stop_times by trip_id
    trip_stops = defaultdict(list)
    for st in stop_times:
        trip_id = st.get('trip_id', '')
        if not trip_id:
            continue
        
        trip_stops[trip_id].append({
            'stop_id': st.get('stop_id', ''),
            'stop_sequence': int(st.get('stop_sequence', 0)),
            'arrival_time': st.get('arrival_time', ''),
            'departure_time': st.get('departure_time', '')
        })
    
    # Build travel time matrix
    travel_matrix = {}
    
    # Process each trip
    for trip_id, stops_list in trip_stops.items():
        stops_list.sort(key=lambda x: x['stop_sequence'])
        
        # For each pair of stops in this trip
        for i in range(len(stops_list)):
            origin = stops_list[i]
            origin_name = stop_names.get(origin['stop_id'], origin['stop_id'])
            
            for j in range(i + 1, len(stops_list)):
                destination = stops_list[j]
                destination_name = stop_names.get(destination['stop_id'], destination['stop_id'])
                
                # Parse times
                try:
                    dep_time = origin['departure_time'].split(':')
                    arr_time = destination['arrival_time'].split(':')
                    
                    dep_minutes = int(dep_time[0]) * 60 + int(dep_time[1])
                    arr_minutes = int(arr_time[0]) * 60 + int(arr_time[1])
                    
                    travel_time = arr_minutes - dep_minutes
                    
                    if travel_time > 0:
                        # Create unique key for this OD pair
                        key = f"{origin_name}|{destination_name}"
                        
                        # Store minimum travel time for this pair
                        if key not in travel_matrix or travel_time < travel_matrix[key]['travel_time_minutes']:
                            travel_matrix[key] = {
                                'origin': origin_name,
                                'destination': destination_name,
                                'travel_time_minutes': travel_time,
                                'num_stops': j - i
                            }
                except (ValueError, IndexError):
                    continue
    
    # Convert to list
    travel_times_list = list(travel_matrix.values())
    
    print(f"✓ Generated {len(travel_times_list)} unique station pairs")
    
    return travel_times_list

def generate_enhanced_statistics():
    """Generate enhanced network statistics with complete travel time matrix."""
    print("=" * 60)
    print("Enhanced CMRL Travel Time Matrix")
    print("=" * 60)
    
    # Build complete travel time matrix
    travel_times = build_travel_time_matrix()
    
    # Load existing statistics
    stats_file = OUTPUT_DIR / "network_statistics.json"
    with open(stats_file, 'r', encoding='utf-8') as f:
        statistics = json.load(f)
    
    # Update with complete travel times
    statistics['all_travel_times'] = travel_times
    statistics['travel_time_count'] = len(travel_times)
    
    # Save updated statistics
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(statistics, f, indent=2)
    
    print(f"\n✓ Updated statistics with {len(travel_times)} station pairs")
    print(f"✓ Saved to: {stats_file}")
    print("=" * 60)
    
    # Show some examples
    print("\nSample long-distance journeys:")
    long_journeys = sorted(travel_times, key=lambda x: x['travel_time_minutes'], reverse=True)[:5]
    for journey in long_journeys:
        print(f"  {journey['origin']} → {journey['destination']}: {journey['travel_time_minutes']} min ({journey['num_stops']} stops)")

if __name__ == "__main__":
    generate_enhanced_statistics()
