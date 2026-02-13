const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Database connection pool
const pool = new Pool({
    user: process.env.DB_USER || 'bharatoraon',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'transit_data_chennai',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all stations (with optional system filter)
app.get('/api/stations', async (req, res) => {
    try {
        const { system } = req.query;

        let query = `
      SELECT 
        stop_id,
        stop_name,
        zone_id,
        parent_station,
        system,
        ST_AsGeoJSON(geom) as geometry
      FROM stops
      WHERE geom IS NOT NULL
        AND (parent_station = '' OR parent_station IS NULL)
    `;

        const params = [];
        if (system) {
            query += ' AND system = $1';
            params.push(system);
        }

        query += ' ORDER BY stop_name';

        const result = await pool.query(query, params);

        const geojson = {
            type: 'FeatureCollection',
            features: result.rows.map(row => ({
                type: 'Feature',
                geometry: JSON.parse(row.geometry),
                properties: {
                    stop_id: row.stop_id,
                    station_name: row.stop_name,
                    zone_id: row.zone_id,
                    parent_station: row.parent_station,
                    system: row.system
                }
            }))
        };

        res.json(geojson);
    } catch (error) {
        console.error('Error fetching stations:', error);
        console.error('Error details:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Get station by ID
app.get('/api/stations/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
      SELECT 
        stop_id,
        stop_name,
        zone_id,
        parent_station,
        system,
        stop_lat,
        stop_lon,
        ST_AsGeoJSON(geom) as geometry
      FROM stops
      WHERE stop_id = $1
    `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Station not found' });
        }

        const row = result.rows[0];
        const geojson = {
            type: 'Feature',
            geometry: JSON.parse(row.geometry),
            properties: {
                stop_id: row.stop_id,
                station_name: row.stop_name,
                zone_id: row.zone_id,
                parent_station: row.parent_station,
                system: row.system,
                stop_lat: row.stop_lat,
                stop_lon: row.stop_lon
            }
        };

        res.json(geojson);
    } catch (error) {
        console.error('Error fetching station:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get stations within bounding box
app.get('/api/stations/within-bounds', async (req, res) => {
    try {
        const { minLon, minLat, maxLon, maxLat, system } = req.query;

        if (!minLon || !minLat || !maxLon || !maxLat) {
            return res.status(400).json({ error: 'Missing bounding box parameters' });
        }

        let query = `
      SELECT 
        stop_id,
        stop_name,
        zone_id,
        system,
        ST_AsGeoJSON(geom) as geometry
      FROM stops
      WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
    `;

        const params = [minLon, minLat, maxLon, maxLat];

        if (system) {
            query += ' AND system = $5';
            params.push(system);
        }

        const result = await pool.query(query, params);

        const geojson = {
            type: 'FeatureCollection',
            features: result.rows.map(row => ({
                type: 'Feature',
                geometry: JSON.parse(row.geometry),
                properties: {
                    stop_id: row.stop_id,
                    station_name: row.stop_name,
                    zone_id: row.zone_id,
                    system: row.system
                }
            }))
        };

        res.json(geojson);
    } catch (error) {
        console.error('Error fetching stations within bounds:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all routes (with optional system filter)
app.get('/api/routes', async (req, res) => {
    try {
        const { system } = req.query;

        let query = `
      SELECT DISTINCT ON (s.shape_id)
        s.shape_id,
        s.system,
        s.color,
        r.route_short_name,
        r.route_long_name,
        r.route_color,
        ST_AsGeoJSON(s.geom) as geometry
      FROM shapes s
      LEFT JOIN trips t ON s.shape_id = t.shape_id
      LEFT JOIN routes r ON t.route_id = r.route_id
      WHERE s.geom IS NOT NULL
    `;

        const params = [];
        if (system) {
            query += ' AND s.system = $1';
            params.push(system);
        }

        const result = await pool.query(query, params);

        const geojson = {
            type: 'FeatureCollection',
            features: result.rows.map(row => ({
                type: 'Feature',
                geometry: JSON.parse(row.geometry),
                properties: {
                    shape_id: row.shape_id,
                    system: row.system,
                    color: row.route_color ? `#${row.route_color}` : (row.color ? `#${row.color}` : '#0054a6'),
                    route_name: row.route_short_name || row.route_long_name || 'Metro Line',
                    line_name: row.route_long_name || row.route_short_name || 'Metro Line'
                }
            }))
        };

        res.json(geojson);
    } catch (error) {
        console.error('Error fetching routes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get travel time between two stations
app.get('/api/travel-time', async (req, res) => {
    try {
        const { origin, destination, system } = req.query;

        if (!origin || !destination) {
            return res.status(400).json({ error: 'Missing origin or destination' });
        }

        let query = `
      SELECT 
        origin_id,
        destination_id,
        travel_time_minutes,
        num_stops,
        system
      FROM travel_time_matrix
      WHERE origin_id = $1 AND destination_id = $2
    `;

        const params = [origin, destination];

        if (system) {
            query += ' AND system = $3';
            params.push(system);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Travel time not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching travel time:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get network statistics
app.get('/api/statistics', async (req, res) => {
    try {
        const { system } = req.query;

        let systemFilter = system ? 'WHERE system = $1' : '';
        const params = system ? [system] : [];

        const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT stop_id) as total_stations,
        COUNT(DISTINCT route_id) as total_routes,
        system
      FROM (
        SELECT stop_id, NULL as route_id, system FROM stops ${systemFilter}
        UNION ALL
        SELECT NULL as stop_id, route_id, system FROM routes ${systemFilter}
      ) combined
      GROUP BY system
    `, params);

        res.json(stats.rows);
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get real-time simulated vehicle positions
app.get('/api/vehicles', async (req, res) => {
    try {
        const { system = 'CMRL', time } = req.query;

        // Use provided time or current IST time
        const currentTimeQuery = time ? `CAST($2 AS time)` : `(CURRENT_TIME AT TIME ZONE 'Asia/Kolkata')::time`;
        const params = [system];
        if (time) params.push(time);

        const query = `
            WITH trip_progress AS (
                SELECT DISTINCT ON (t.trip_id)
                    t.trip_id,
                    t.route_id,
                    t.shape_id,
                    r.route_long_name,
                    r.route_color,
                    st1.stop_id as from_stop_id,
                    st2.stop_id as to_stop_id,
                    st1.departure_time,
                    st2.arrival_time as next_arrival_time,
                    EXTRACT(EPOCH FROM (${currentTimeQuery} - st1.departure_time)) / 
                    NULLIF(EXTRACT(EPOCH FROM (st2.arrival_time - st1.departure_time)), 0) as segment_progress
                FROM trips t
                JOIN routes r ON t.route_id = r.route_id
                JOIN stop_times st1 ON t.trip_id = st1.trip_id
                JOIN stop_times st2 ON t.trip_id = st2.trip_id AND st2.stop_sequence = st1.stop_sequence + 1
                WHERE t.system = $1
                  AND ${currentTimeQuery} >= st1.departure_time 
                  AND ${currentTimeQuery} < st2.arrival_time
                ORDER BY t.trip_id, st1.stop_sequence
            ),
            vehicle_coords AS (
                SELECT 
                    tp.*,
                    s.geom as shape_geom,
                    ST_LineLocatePoint(s.geom, stop_from.geom) as locate_from,
                    ST_LineLocatePoint(s.geom, stop_to.geom) as locate_to
                FROM trip_progress tp
                JOIN shapes s ON tp.shape_id = s.shape_id
                JOIN stops stop_from ON tp.from_stop_id = stop_from.stop_id
                JOIN stops stop_to ON tp.to_stop_id = stop_to.stop_id
            )
            SELECT 
                trip_id,
                route_id,
                route_long_name as route_name,
                route_color,
                ST_AsGeoJSON(
                    ST_LineInterpolatePoint(
                        shape_geom, 
                        LEAST(1.0, GREATEST(0.0, locate_from + (segment_progress * (locate_to - locate_from))))
                    )
                ) as geometry
            FROM vehicle_coords
            WHERE shape_geom IS NOT NULL;
        `;

        // Note: PostgreSQL doesn't have GREATER/LEAST for all types directly like this in some versions, 
        // using GREATEST/LEAST or CASE logic is safer.

        const correctedQuery = query.replace('GREATER(0.0,', 'GREATEST(0,').replace('LEAST(1.0,', 'LEAST(1,');

        const result = await pool.query(correctedQuery, params);

        const geojson = {
            type: 'FeatureCollection',
            features: result.rows.map(row => ({
                type: 'Feature',
                geometry: JSON.parse(row.geometry),
                properties: {
                    trip_id: row.trip_id,
                    route_id: row.route_id,
                    route_name: row.route_name,
                    color: row.route_color ? `#${row.route_color}` : '#0054a6'
                }
            }))
        };

        res.json(geojson);
    } catch (error) {
        console.error('Error fetching vehicle positions:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Transit API server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    pool.end(() => {
        console.log('Database pool closed');
    });
});
