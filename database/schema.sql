-- Transit Data Chennai - PostGIS Database Schema
-- Enable PostGIS extension

CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS travel_time_matrix CASCADE;
DROP TABLE IF EXISTS stop_times CASCADE;
DROP TABLE IF EXISTS fare_rules CASCADE;
DROP TABLE IF EXISTS fare_attributes CASCADE;
DROP TABLE IF EXISTS calendar_dates CASCADE;
DROP TABLE IF EXISTS calendar CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS shapes CASCADE;
DROP TABLE IF EXISTS stops CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS agency CASCADE;

-- Agency table
CREATE TABLE agency (
    agency_id VARCHAR(50) PRIMARY KEY,
    agency_name VARCHAR(255) NOT NULL,
    agency_url VARCHAR(255),
    agency_timezone VARCHAR(50),
    agency_lang VARCHAR(10),
    agency_phone VARCHAR(50),
    agency_email VARCHAR(100),
    system VARCHAR(10) NOT NULL  -- CMRL, MTC, SR
);

-- Routes table
CREATE TABLE routes (
    route_id VARCHAR(50) PRIMARY KEY,
    agency_id VARCHAR(50) REFERENCES agency(agency_id),
    route_short_name VARCHAR(50),
    route_long_name VARCHAR(255),
    route_type INTEGER,
    route_color VARCHAR(6),
    route_text_color VARCHAR(6),
    system VARCHAR(10) NOT NULL
);

-- Stops table with PostGIS geometry
CREATE TABLE stops (
    stop_id VARCHAR(50) PRIMARY KEY,
    stop_name VARCHAR(255) NOT NULL,
    stop_lat DECIMAL(10, 8),
    stop_lon DECIMAL(11, 8),
    geom GEOMETRY(Point, 4326),
    zone_id VARCHAR(50),
    parent_station VARCHAR(50),
    location_type INTEGER,
    system VARCHAR(10) NOT NULL
);

-- Shapes table with PostGIS geometry
CREATE TABLE shapes (
    shape_id VARCHAR(50) PRIMARY KEY,
    geom GEOMETRY(LineString, 4326),
    system VARCHAR(10) NOT NULL,
    route_id VARCHAR(50),
    color VARCHAR(6),
    length_km DECIMAL(10, 2)
);

-- Trips table
CREATE TABLE trips (
    trip_id VARCHAR(50) PRIMARY KEY,
    route_id VARCHAR(50) REFERENCES routes(route_id),
    service_id VARCHAR(50),
    trip_headsign VARCHAR(255),
    shape_id VARCHAR(50),
    direction_id INTEGER,
    system VARCHAR(10) NOT NULL
);

-- Stop times table
CREATE TABLE stop_times (
    id SERIAL PRIMARY KEY,
    trip_id VARCHAR(50) REFERENCES trips(trip_id),
    stop_id VARCHAR(50) REFERENCES stops(stop_id),
    stop_sequence INTEGER NOT NULL,
    arrival_time TIME,
    departure_time TIME,
    stop_headsign VARCHAR(255)
);

-- Calendar table
CREATE TABLE calendar (
    service_id VARCHAR(50) PRIMARY KEY,
    monday INTEGER,
    tuesday INTEGER,
    wednesday INTEGER,
    thursday INTEGER,
    friday INTEGER,
    saturday INTEGER,
    sunday INTEGER,
    start_date DATE,
    end_date DATE,
    system VARCHAR(10) NOT NULL
);

-- Calendar dates table
CREATE TABLE calendar_dates (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(50),
    date DATE,
    exception_type INTEGER,
    system VARCHAR(10) NOT NULL
);

-- Fare attributes table
CREATE TABLE fare_attributes (
    fare_id VARCHAR(50) PRIMARY KEY,
    price DECIMAL(10, 2),
    currency_type VARCHAR(3),
    payment_method INTEGER,
    transfers INTEGER,
    transfer_duration INTEGER,
    system VARCHAR(10) NOT NULL
);

-- Fare rules table
CREATE TABLE fare_rules (
    id SERIAL PRIMARY KEY,
    fare_id VARCHAR(50) REFERENCES fare_attributes(fare_id),
    route_id VARCHAR(50),
    origin_id VARCHAR(50),
    destination_id VARCHAR(50),
    system VARCHAR(10) NOT NULL
);

-- Travel time matrix (pre-calculated)
CREATE TABLE travel_time_matrix (
    id SERIAL PRIMARY KEY,
    origin_id VARCHAR(50) REFERENCES stops(stop_id),
    destination_id VARCHAR(50) REFERENCES stops(stop_id),
    travel_time_minutes INTEGER NOT NULL,
    num_stops INTEGER NOT NULL,
    system VARCHAR(10) NOT NULL,
    UNIQUE(origin_id, destination_id, system)
);

-- Create spatial indexes
CREATE INDEX idx_stops_geom ON stops USING GIST(geom);
CREATE INDEX idx_shapes_geom ON shapes USING GIST(geom);

-- Create regular indexes for common queries
CREATE INDEX idx_routes_system ON routes(system);
CREATE INDEX idx_stops_system ON stops(system);
CREATE INDEX idx_shapes_system ON shapes(system);
CREATE INDEX idx_stop_times_trip ON stop_times(trip_id);
CREATE INDEX idx_stop_times_stop ON stop_times(stop_id);
CREATE INDEX idx_trips_route ON trips(route_id);
CREATE INDEX idx_travel_matrix_origin ON travel_time_matrix(origin_id);
CREATE INDEX idx_travel_matrix_dest ON travel_time_matrix(destination_id);
CREATE INDEX idx_travel_matrix_system ON travel_time_matrix(system);

-- Create function to update geometry from lat/lon
CREATE OR REPLACE FUNCTION update_stop_geometry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.stop_lat IS NOT NULL AND NEW.stop_lon IS NOT NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.stop_lon, NEW.stop_lat), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update geometry
CREATE TRIGGER trg_update_stop_geometry
BEFORE INSERT OR UPDATE ON stops
FOR EACH ROW
EXECUTE FUNCTION update_stop_geometry();

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
