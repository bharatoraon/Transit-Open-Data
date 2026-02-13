#!/usr/bin/env python3
"""
Import GTFS data into PostGIS database.
Usage: python gtfs_to_postgis.py
"""

import csv
import psycopg2
from psycopg2.extras import execute_values
from pathlib import Path
import sys
from collections import defaultdict

# Database configuration
DB_CONFIG = {
    'dbname': 'transit_data_chennai',
    'user': 'bharatoraon',
    'password': '',
    'host': 'localhost',
    'port': '5432'
}

# GTFS directories
GTFS_BASE = Path(__file__).parent.parent / "GTFS"
SYSTEMS = {
    'CMRL': GTFS_BASE / "CMRL",
    'MTC': GTFS_BASE / "MTC"
}

def read_csv(filepath):
    """Read CSV file and return list of dictionaries."""
    if not filepath.exists():
        print(f"Warning: {filepath} not found, skipping...")
        return []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)

def connect_db():
    """Connect to PostgreSQL database."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print(f"✓ Connected to database: {DB_CONFIG['dbname']}")
        return conn
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        sys.exit(1)

def import_agency(conn, system, gtfs_dir):
    """Import agency data."""
    print(f"  Importing agency for {system}...")
    
    agencies = read_csv(gtfs_dir / "agency.txt")
    
    cursor = conn.cursor()
    
    if not agencies:
        # Create default agency if file is missing
        cursor.execute("""
            INSERT INTO agency (agency_id, agency_name, agency_url, agency_timezone, 
                              agency_lang, agency_phone, agency_email, system)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (agency_id) DO NOTHING
        """, (system, system, '', 'Asia/Kolkata', 'en', '', '', system))
        print(f"    ✓ Created default agency for {system}")
    else:
        for agency in agencies:
            cursor.execute("""
                INSERT INTO agency (agency_id, agency_name, agency_url, agency_timezone, 
                                  agency_lang, agency_phone, agency_email, system)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (agency_id) DO NOTHING
            """, (
                agency.get('agency_id', system),
                agency.get('agency_name', ''),
                agency.get('agency_url', ''),
                agency.get('agency_timezone', ''),
                agency.get('agency_lang', ''),
                agency.get('agency_phone', ''),
                agency.get('agency_email', ''),
                system
            ))
        print(f"    ✓ Imported {len(agencies)} agencies")
    
    conn.commit()

def import_routes(conn, system, gtfs_dir):
    """Import routes data."""
    print(f"  Importing routes for {system}...")
    
    routes = read_csv(gtfs_dir / "routes.txt")
    if not routes:
        return
    
    cursor = conn.cursor()
    
    for route in routes:
        cursor.execute("""
            INSERT INTO routes (route_id, agency_id, route_short_name, route_long_name,
                              route_type, route_color, route_text_color, system)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (route_id) DO NOTHING
        """, (
            route.get('route_id', ''),
            route.get('agency_id', system),
            route.get('route_short_name', ''),
            route.get('route_long_name', ''),
            int(route.get('route_type', 0)) if route.get('route_type') else 0,
            route.get('route_color', ''),
            route.get('route_text_color', ''),
            system
        ))
    
    conn.commit()
    print(f"    ✓ Imported {len(routes)} routes")

def import_stops(conn, system, gtfs_dir):
    """Import stops data with PostGIS geometry."""
    print(f"  Importing stops for {system}...")
    
    stops = read_csv(gtfs_dir / "stops.txt")
    if not stops:
        return
    
    cursor = conn.cursor()
    count = 0
    
    for stop in stops:
        try:
            lat = float(stop.get('stop_lat', 0))
            lon = float(stop.get('stop_lon', 0))
            
            if lat == 0 or lon == 0:
                continue
            
            cursor.execute("""
                INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon,
                                 zone_id, parent_station, location_type, system)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (stop_id) DO NOTHING
            """, (
                stop.get('stop_id', ''),
                stop.get('stop_name', ''),
                lat,
                lon,
                stop.get('zone_id', ''),
                stop.get('parent_station', ''),
                int(stop.get('location_type', 0)) if stop.get('location_type') else 0,
                system
            ))
            count += 1
        except (ValueError, KeyError) as e:
            continue
    
    conn.commit()
    print(f"    ✓ Imported {count} stops")

def import_shapes(conn, system, gtfs_dir):
    """Import shapes data with PostGIS LineString geometry."""
    print(f"  Importing shapes for {system}...")
    
    shapes = read_csv(gtfs_dir / "shapes.txt")
    if not shapes:
        return
    
    # Group by shape_id
    shape_groups = defaultdict(list)
    for shape in shapes:
        shape_id = shape.get('shape_id', '').strip()
        if not shape_id:
            continue
        
        try:
            lat = float(shape['shape_pt_lat'])
            lon = float(shape['shape_pt_lon'])
            seq = int(shape.get('shape_pt_sequence', 0))
            shape_groups[shape_id].append({'lat': lat, 'lon': lon, 'seq': seq})
        except (ValueError, KeyError):
            continue
    
    cursor = conn.cursor()
    count = 0
    
    for shape_id, points in shape_groups.items():
        # Sort by sequence
        points.sort(key=lambda p: p['seq'])
        
        # Create WKT LineString
        coords = ', '.join([f"{p['lon']} {p['lat']}" for p in points])
        wkt = f"LINESTRING({coords})"
        
        cursor.execute("""
            INSERT INTO shapes (shape_id, geom, system)
            VALUES (%s, ST_GeomFromText(%s, 4326), %s)
            ON CONFLICT (shape_id) DO NOTHING
        """, (shape_id, wkt, system))
        count += 1
    
    conn.commit()
    print(f"    ✓ Imported {count} shapes")

def import_trips(conn, system, gtfs_dir):
    """Import trips data."""
    print(f"  Importing trips for {system}...")
    
    trips = read_csv(gtfs_dir / "trips.txt")
    if not trips:
        return
    
    cursor = conn.cursor()
    
    for trip in trips:
        cursor.execute("""
            INSERT INTO trips (trip_id, route_id, service_id, trip_headsign,
                             shape_id, direction_id, system)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (trip_id) DO NOTHING
        """, (
            trip.get('trip_id', ''),
            trip.get('route_id', ''),
            trip.get('service_id', ''),
            trip.get('trip_headsign', ''),
            trip.get('shape_id', ''),
            int(trip.get('direction_id', 0)) if trip.get('direction_id') else 0,
            system
        ))
    
    conn.commit()
    print(f"    ✓ Imported {len(trips)} trips")

def import_stop_times(conn, system, gtfs_dir):
    """Import stop_times data."""
    print(f"  Importing stop_times for {system}...")
    
    stop_times = read_csv(gtfs_dir / "stop_times.txt")
    if not stop_times:
        return
    
    cursor = conn.cursor()
    batch = []
    
    for st in stop_times:
        batch.append((
            st.get('trip_id', ''),
            st.get('stop_id', ''),
            int(st.get('stop_sequence', 0)) if st.get('stop_sequence') else 0,
            st.get('arrival_time', None),
            st.get('departure_time', None),
            st.get('stop_headsign', '')
        ))
        
        # Batch insert every 1000 records
        if len(batch) >= 1000:
            execute_values(cursor, """
                INSERT INTO stop_times (trip_id, stop_id, stop_sequence, 
                                      arrival_time, departure_time, stop_headsign)
                VALUES %s
            """, batch)
            batch = []
    
    # Insert remaining
    if batch:
        execute_values(cursor, """
            INSERT INTO stop_times (trip_id, stop_id, stop_sequence,
                                  arrival_time, departure_time, stop_headsign)
            VALUES %s
        """, batch)
    
    conn.commit()
    print(f"    ✓ Imported {len(stop_times)} stop_times")

def import_system(conn, system, gtfs_dir):
    """Import all GTFS files for a system."""
    print(f"\n{'='*60}")
    print(f"Importing {system} GTFS data from {gtfs_dir}")
    print(f"{'='*60}")
    
    import_agency(conn, system, gtfs_dir)
    import_routes(conn, system, gtfs_dir)
    import_stops(conn, system, gtfs_dir)
    import_shapes(conn, system, gtfs_dir)
    import_trips(conn, system, gtfs_dir)
    import_stop_times(conn, system, gtfs_dir)
    
    print(f"✓ Completed {system} import\n")

def main():
    """Main import function."""
    print("=" * 60)
    print("GTFS to PostGIS Importer")
    print("=" * 60)
    
    # Connect to database
    conn = connect_db()
    
    # Import each system
    for system, gtfs_dir in SYSTEMS.items():
        if gtfs_dir.exists():
            import_system(conn, system, gtfs_dir)
        else:
            print(f"Warning: {gtfs_dir} not found, skipping {system}")
    
    # Close connection
    conn.close()
    print("=" * 60)
    print("✓ Import completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
