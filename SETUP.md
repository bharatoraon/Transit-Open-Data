# GTFS to PostGIS Pipeline - Setup Guide

## Prerequisites

- Docker and Docker Compose installed
- Python 3.8+ (for GTFS import script)
- Node.js 18+ (for local API development)

## Quick Start

### 1. Start Database and API

```bash
# Start PostGIS database and API server
docker-compose up -d

# Check if services are running
docker-compose ps
```

### 2. Install Python Dependencies

```bash
# Install psycopg2 for database import
pip install psycopg2-binary
```

### 3. Import GTFS Data

```bash
# Run the import script
python database/gtfs_to_postgis.py
```

### 4. Verify API

```bash
# Check API health
curl http://localhost:3000/health

# Get CMRL stations
curl http://localhost:3000/api/stations?system=CMRL

# Get CMRL routes
curl http://localhost:3000/api/routes?system=CMRL
```

## API Endpoints

### Stations

- `GET /api/stations` - Get all stations
- `GET /api/stations?system=CMRL` - Get stations for specific system
- `GET /api/stations/:id` - Get station by ID
- `GET /api/stations/within-bounds?minLon=80.1&minLat=13.0&maxLon=80.3&maxLat=13.1` - Get stations within bounding box

### Routes

- `GET /api/routes` - Get all routes
- `GET /api/routes?system=CMRL` - Get routes for specific system

### Travel Times

- `GET /api/travel-time?origin=SCC&destination=SAP` - Get travel time between stations

### Statistics

- `GET /api/statistics` - Get network statistics
- `GET /api/statistics?system=CMRL` - Get statistics for specific system

## Database Access

```bash
# Connect to PostgreSQL
docker exec -it transit_db psql -U postgres -d transit_data_chennai

# Run queries
SELECT COUNT(*) FROM stops WHERE system = 'CMRL';
SELECT COUNT(*) FROM shapes WHERE system = 'CMRL';
```

## Development

### Run API Locally (without Docker)

```bash
cd server
npm install
npm run dev
```

### Environment Variables

Create `.env` file in server directory:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=transit_data_chennai
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3000
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose logs postgres

# Restart services
docker-compose restart
```

### Import Script Errors

```bash
# Check database schema
docker exec -it transit_db psql -U postgres -d transit_data_chennai -c "\dt"

# Verify PostGIS extension
docker exec -it transit_db psql -U postgres -d transit_data_chennai -c "SELECT PostGIS_version();"
```

## Next Steps

1. Update frontend to use API endpoints
2. Add travel time matrix calculation
3. Implement caching for better performance
4. Add authentication for production deployment
