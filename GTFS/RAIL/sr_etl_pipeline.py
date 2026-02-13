import geopandas as gpd
import pandas as pd
import shapely
from shapely.geometry import Point, LineString
import os
import logging
import sqlite3

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constants
DATA_DIR = "/Users/bharatoraon/Documents/Cumta_Data/Southern Railways"
OUTPUT_FILE = os.path.join(DATA_DIR, "sr_transit_warehouse.gpkg")

def load_data():
    logger.info("Loading data...")
    stations = gpd.read_file(os.path.join(DATA_DIR, "Suburban stations with Station_Code.geojson"))
    corridors = gpd.read_file(os.path.join(DATA_DIR, "suburban_corridor.geojson"))
    entries = gpd.read_file(os.path.join(DATA_DIR, "Suburban entry exit.geojson"))
    return {"stations": stations, "corridors": corridors, "entries": entries}

def process_stations(data):
    logger.info("Processing stations...")
    st = data["stations"]
    # Columns: S.NO, STATION CODE, STATION NAME, LATITUDE, LONGITUDE, geometry
    # Normalize to standard schema
    st = st.rename(columns={
        "STATION CODE": "stop_id",
        "STATION NAME": "stop_name"
    })
    
    # Ensure CRS
    if st.crs != "EPSG:4326":
        st = st.to_crs("EPSG:4326")
        
    return st[['stop_id', 'stop_name', 'geometry']]

def process_corridors(data):
    logger.info("Processing corridors...")
    corr = data["corridors"]
    # Columns: name, geometry
    if corr.crs != "EPSG:4326":
        corr = corr.to_crs("EPSG:4326")
        
    # Standardize name
    corr = corr.rename(columns={"name": "route_long_name"})
    return corr

def link_entries(data, stations_gdf):
    logger.info("Linking entries...")
    entries = data["entries"]
    if entries.crs != "EPSG:4326":
        entries = entries.to_crs("EPSG:4326")
        
    # Spatial join closest station
    # We want to know which station this entry belongs to
    # Join entries to stations
    joined = gpd.sjoin_nearest(entries, stations_gdf, how="left")
    
    # Keep relevant cols
    # 'Station_Name', 'Entry_Exit_Name', 'Lift', 'Escalator', 'Subway', 'Ticket Counter', 'stop_id', 'stop_name'
    cols = ['Station_Name', 'Entry_Exit_Name', 'Lift', 'Escalator', 'Subway', 'Ticket Counter', 'stop_id', 'stop_name', 'geometry']
    return joined[cols]

def main():
    try:
        data = load_data()
        
        # 1. Stations
        stations_gdf = process_stations(data)
        
        # 2. Corridors
        corridors_gdf = process_corridors(data)
        
        # 3. Entries
        entries_gdf = link_entries(data, stations_gdf)
        
        # 4. Synthesize Routes Attribute Table
        # Extract unique names from corridor
        unique_routes = corridors_gdf['route_long_name'].dropna().unique()
        routes_df = pd.DataFrame({
            'route_id': [f"SR_{i}" for i in range(len(unique_routes))],
            'route_long_name': unique_routes,
            'agency_id': 'SR'
        })
        # Add a placeholder for "All/Generic" if corridors are un-named
        if routes_df.empty:
             routes_df = pd.DataFrame([{'route_id': 'SR_GEN', 'route_long_name': 'Suburban Network', 'agency_id': 'SR'}])

        # 5. Empty tables for schema compatibility
        trips_df = pd.DataFrame(columns=['route_id', 'service_id', 'trip_id', 'trip_headsign'])
        stop_times_df = pd.DataFrame(columns=['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'])
        
        logger.info(f"Writing to {OUTPUT_FILE}...")
        
        stations_gdf.to_file(OUTPUT_FILE, layer='rail_stations', driver="GPKG")
        corridors_gdf.to_file(OUTPUT_FILE, layer='rail_corridors', driver="GPKG")
        entries_gdf.to_file(OUTPUT_FILE, layer='rail_entries', driver="GPKG")
        
        # Write Tables
        conn = sqlite3.connect(OUTPUT_FILE)
        routes_df.to_sql('routes', conn, if_exists='replace', index=False)
        trips_df.to_sql('trips', conn, if_exists='replace', index=False)
        stop_times_df.to_sql('stop_times', conn, if_exists='replace', index=False)
        
        conn.close()
        logger.info("Done!")
        
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)

if __name__ == "__main__":
    main()
