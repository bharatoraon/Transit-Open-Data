#!/usr/bin/env python3
"""
Convert CMRL GTFS data to GeoJSON format for map visualization.
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

def create_cmrl_stations_geojson():
    """Convert CMRL stops to GeoJSON points."""
    print("Processing CMRL stations...")
    
    stops_file = GTFS_DIR / "stops.txt"
    stops = read_csv(stops_file)
    
    # Group by parent_station to get unique stations
    stations = {}
    for stop in stops:
        if not stop.get('stop_lat') or not stop.get('stop_lon'):
            continue
        
        try:
            lat = float(stop['stop_lat'])
            lon = float(stop['stop_lon'])
        except (ValueError, KeyError):
            continue
        
        parent = stop.get('parent_station', stop['stop_id'])
        if parent not in stations:
            stations[parent] = {
                'lat': lat,
                'lon': lon,
                'name': stop['stop_name'],
                'zone_id': stop.get('zone_id', ''),
                'stop_id': stop['stop_id']
            }
    
    features = []
    for station_id, station in stations.items():
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [station['lon'], station['lat']]
            },
            "properties": {
                "stop_id": station['stop_id'],
                "station_name": station['name'],
                "zone_id": station['zone_id'],
                "system": "CMRL"
            }
        }
        features.append(feature)
    
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / "cmrl_stations.geojson"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"✓ Created {output_file} with {len(features)} stations")
    return geojson

def create_cmrl_lines_geojson():
    """Convert CMRL shapes to GeoJSON lines with route colors."""
    print("Processing CMRL metro lines...")
    
    shapes_file = GTFS_DIR / "shapes.txt"
    routes_file = GTFS_DIR / "routes.txt"
    
    # Read routes to get colors
    routes = read_csv(routes_file)
    route_info = {}
    for route in routes:
        route_id = route.get('route_id', '')
        route_info[route_id] = {
            'short_name': route.get('route_short_name', ''),
            'long_name': route.get('route_long_name', ''),
            'color': f"#{route.get('route_color', '0054a6')}" if route.get('route_color') else "#0054a6"
        }
    
    # Read shapes
    shapes = read_csv(shapes_file)
    
    # Group shapes by shape_id
    shape_groups = defaultdict(list)
    for shape in shapes:
        shape_id = shape.get('shape_id', '').strip()
        if not shape_id:
            continue
        
        try:
            lat = float(shape['shape_pt_lat'])
            lon = float(shape['shape_pt_lon'])
            seq = int(shape.get('shape_pt_sequence', 0))
        except (ValueError, KeyError):
            continue
        
        shape_groups[shape_id].append({
            'lat': lat,
            'lon': lon,
            'seq': seq
        })
    
    # Create features
    features = []
    for shape_id, points in shape_groups.items():
        # Sort by sequence
        points.sort(key=lambda p: p['seq'])
        
        # Create coordinates array
        coordinates = [[p['lon'], p['lat']] for p in points]
        
        # Determine color based on shape_id
        # Blue line: sh18, sh19
        # Green line: sh7, sh8, sh13, sh14, sh17, sh20
        if shape_id in ['sh18', 'sh19']:
            color = "#000092"  # Blue
            line_name = "Blue Line (Airport - Wimco Nagar)"
        else:
            color = "#00A700"  # Green
            line_name = "Green Line (St. Thomas Mount - Central/CMBT)"
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": coordinates
            },
            "properties": {
                "shape_id": shape_id,
                "line_name": line_name,
                "color": color,
                "system": "CMRL"
            }
        }
        
        features.append(feature)
    
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    output_file = OUTPUT_DIR / "cmrl_lines.geojson"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"✓ Created {output_file} with {len(features)} metro lines")
    return geojson

def main():
    """Main conversion function."""
    print("=" * 60)
    print("CMRL GTFS to GeoJSON Converter")
    print("=" * 60)
    
    create_cmrl_stations_geojson()
    create_cmrl_lines_geojson()
    
    print("=" * 60)
    print("✓ Conversion complete!")
    print(f"Output directory: {OUTPUT_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
