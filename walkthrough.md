# Walkthrough - Suburban Rail Integration

I have successfully integrated the Suburban Rail data into the map and applied the requested "railway" visual style.

## Changes

### 1. Data Integration
- **Moved & Renamed Files**:
    - `suburban_corridor.geojson` -> `client/public/data/suburban_lines.geojson`
    - `"GTFS/RAIL/suburban stations.geojson"` -> `client/public/data/suburban_stops.geojson`

### 2. Map Implementation (`Maps.jsx`)
- **Sources**: Added `suburban_lines` and `suburban_stops` GeoJSON sources.
- **Layers**:
    - **Rail Lines**: Implemented a "cased" line style to resemble tracks.
        - *Base Layer*: Thick black line (`#000000`, 4px).
        - *Inner Layer*: Dashed white line (`#ffffff`, 2px, dasharray `[2, 2]`).
    - **Stations**: Added station markers (white circle with green stroke) and labels.
- **Controls**:
    - Added "Suburban Rail" section to the Layers sidebar with toggles for Lines, Stations, and Labels.
    - Updated toggle logic to handle the multi-layer rail style.
- **Legend**:
    - Added "Suburban Railway" (dashed line icon) and "Suburban Station" to the Legend.

### 3. Sidebar Reordering
- Moved "Suburban Rail" section below "MTC Bus" in the Layer Controls to reflect the visual layer stack (and user request).
- Correct Order: Metro -> MTC -> Suburban.

### 4. Station Data Update
- Replaced `suburban_stops.geojson` with `Suburban stations with Station_Code.geojson`.
- Updated `Maps.jsx` to display:
    - **Station Name** (from `STATION NAME` property).
    - **Station Code** (from `STATION CODE` property) in the popup.

## Verification Results

### Automated Verification
I used a browser agent to verify the changes.

**Map Visualization**:
![Suburban Rail Verification](/Users/bharatoraon/.gemini/antigravity/brain/09702c42-2f15-488c-95b6-8d02c494e3e2/verify_railway_style_1770967980879.webp)

**Sidebar Order**:
**Sidebar Order**:
![Sidebar Order](/Users/bharatoraon/.gemini/antigravity/brain/09702c42-2f15-488c-95b6-8d02c494e3e2/layers_sidebar_order_1770972814549.png)

**Station Popup**:
![Station Popup](/Users/bharatoraon/.gemini/antigravity/brain/09702c42-2f15-488c-95b6-8d02c494e3e2/suburban_station_popup_verification_1770974840118.png)

**Findings**:
- Map loads correctly.
- "Suburban Rail" section appears in the sidebar below MTC.
- Toggling "Rail Lines" works and shows the railway track style (Black + White Dashed).
- Toggling "Rail Lines" works and shows the railway track style (Black + White Dashed).
- Legend correctly shows "Suburban Railway" with the new icon.
- Station popups correctly show **Station Name** and **Station Code**.

## Deployment

The code has been pushed to the repository:
- **Repo**: [bharatoraon/Transit-Open-Data](https://github.com/bharatoraon/Transit-Open-Data)
- **Branch**: `main`

## Vercel Deployment Instructions

1.  **Import Project**: Select the `Transit-Open-Data` repo in Vercel.
2.  **Environment Variables**:
    - Add `VITE_API_URL` to the **Environment Variables** section.
    - Set the value to your **deployed backend URL** (e.g., `https://your-app.vercel.app` if serving API from same domain, or the full URL of your separate backend).
    - **Important**: For the frontend build to pick this up, the variable name must start with `VITE_`.
3.  **Build Command**: `npm run build`
4.  **Output Directory**: `dist` (default for Vite)

## Server Deployment (Backend)

Since your backend uses Node.js and PostgreSQL, **Render** or **Railway** are the easiest free/low-cost options. Vercel is optimized for frontend/serverless and is harder to configure for a persistent Express server.

### Option 1: Render (Recommended for simplicity)

1.  **Create Account**: Sign up at [render.com](https://render.com).
2.  **New Web Service**:
    -   Connect your GitHub repo: `bharatoraon/Transit-Open-Data`
    -   **Root Directory**: `server` (Important!)
    -   **Build Command**: `npm install`
    -   **Start Command**: `node index.js`
3.  **Environment Variables**:
    -   Add `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` (You need a hosted PostgreSQL database first).
    -   Render offers a managed PostgreSQL database you can create and link easily.

### Option 2: Railway (Best Developer Experience)

1.  **Create Project**: Sign up at [railway.app](https://railway.app) and create a new project.
2.  **Add Database**: Add a **PostgreSQL** service.
3.  **Add Service**: Connect your GitHub repo.
    -   Set **Root Directory** to `server`.
    -   Railway handles the rest automatically.
4.  **Variables**: It automatically provides `DATABASE_URL` to your app. You might need to update `index.js` to use `process.env.DATABASE_URL` if you want zero-config.

### Critical Next Step
Once your backend is deployed, copy its URL (e.g., `https://transit-api.onrender.com`) and update the `VITE_API_URL` environment variable in your **Vercel** project settings. Then redeploy the frontend.


