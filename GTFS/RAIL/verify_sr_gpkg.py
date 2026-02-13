import geopandas as gpd
import pandas as pd
import sqlite3
import os

OUTPUT_FILE = "/Users/bharatoraon/Documents/Cumta_Data/Southern Railways/sr_transit_warehouse.gpkg"

def verify():
    print(f"Verifying {OUTPUT_FILE}...")
    
    # Check layers
    try:
        import fiona
        layers = fiona.listlayers(OUTPUT_FILE)
        print(f"Spatial Layers: {layers}")
        
        for layer in layers:
            gdf = gpd.read_file(OUTPUT_FILE, layer=layer)
            print(f"Layer '{layer}': {len(gdf)} features")
    except Exception as e:
        print(f"Error checking spatial layers: {e}")

    # Check non-spatial tables
    try:
        conn = sqlite3.connect(OUTPUT_FILE)
        tables = ['routes', 'trips', 'stop_times']
        
        print("\nTable Counts:")
        for t in tables:
            try:
                count = pd.read_sql(f"SELECT count(*) FROM {t}", conn).iloc[0,0]
                print(f"Table '{t}': {count} rows")
            except Exception as e:
                print(f"Table '{t}' missing or error: {e}")
                
        # Check routes content
        routes = pd.read_sql("SELECT * FROM routes LIMIT 5", conn)
        print("\nRoutes Sample:")
        print(routes)
        
        conn.close()
    except Exception as e:
        print(f"Error checking sqlite tables: {e}")

if __name__ == "__main__":
    verify()
