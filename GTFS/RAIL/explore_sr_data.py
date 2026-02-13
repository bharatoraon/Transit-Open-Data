import geopandas as gpd
import os

DATA_DIR = "/Users/bharatoraon/Documents/Cumta_Data/Southern Railways"

def inspect_geojson(filename):
    path = os.path.join(DATA_DIR, filename)
    print(f"--- Inspecting {filename} ---")
    try:
        gdf = gpd.read_file(path)
        print(f"CRS: {gdf.crs}")
        print(f"Columns: {list(gdf.columns)}")
        print(gdf.head(2))
        print("-" * 30)
    except Exception as e:
        print(f"Error reading {filename}: {e}")

files = [
    "Suburban entry exit.geojson",
    "Suburban stations with Station_Code.geojson",
    "suburban stations.geojson",
    "suburban_corridor.geojson"
]

for f in files:
    inspect_geojson(f)
