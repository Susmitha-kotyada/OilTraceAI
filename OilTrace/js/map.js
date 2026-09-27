/**
 * OIL TRACE AI - INTERACTIVE MARINE MAP CONTROLLER
 * Powered by Leaflet.js with Dark Maritime Cartography,
 * Potential Oil Spill Polygons, AIS Vessel Markers & Trajectory Tracks.
 */

window.OilTraceMap = (function() {
  let mapInstance = null;
  let layers = {
    spills: null,
    candidates: null,
    ambient: null,
    trajectories: null
  };
  let activeTrajectoryVesselId = 'vessel-1';
  let showTrajectories = true;
  let currentTheme = 'dark';
  let tileLayer = null;
  let retryCount = 0;

  // Initialize Map
  function init(containerId = 'marine-map') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Check if Leaflet is available
    if (typeof L === 'undefined') {
      if (retryCount < 5) {
        retryCount++;
        setTimeout(() => init(containerId), 250);
        return;
      } else {
        // Fallback to internal high-performance tactical vector chart
        initFallbackVectorChart(container);
        return;
      }
    }

    if (mapInstance) {
      mapInstance.invalidateSize();
      return;
    }

    // Default center: Dover Strait / Southern North Sea
    const initialCenter = [51.2185, 1.6240];
    const initialZoom = 11;

    mapInstance = L.map(containerId, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false
    });

    // Custom Zoom control at top-left
    L.control.zoom({ position: 'topleft' }).addTo(mapInstance);

    // Maritime CartoDB Basemap (Respects Dark / Light Theme)
    const initialTileUrl = currentTheme === 'light'
      ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    tileLayer = L.tileLayer(initialTileUrl, {
      maxZoom: 18,
      subdomains: 'abcd'
    });

    // Fallback error handler for tiles (in case of offline/firewall)
    tileLayer.on('tileerror', function() {
      container.style.backgroundColor = currentTheme === 'light' ? '#f0f4f9' : '#040914';
    });

    tileLayer.addTo(mapInstance);

    // Initialize Layer Groups
    layers.spills = L.layerGroup().addTo(mapInstance);
    layers.trajectories = L.layerGroup().addTo(mapInstance);
    layers.candidates = L.layerGroup().addTo(mapInstance);
    layers.ambient = L.layerGroup().addTo(mapInstance);

    // Populate Map Entities
    renderSpillPolygons();
    renderCandidateVessels();
    renderAmbientTraffic();
    renderTrajectories();

    // Mouse coordinates tracker
    const coordsOverlay = document.getElementById('map-live-coords');
    if (coordsOverlay) {
      mapInstance.on('mousemove', function(e) {
        const lat = e.latlng.lat.toFixed(4);
        const lon = e.latlng.lng.toFixed(4);
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';
        coordsOverlay.textContent = `${Math.abs(lat)}° ${latDir}, ${Math.abs(lon)}° ${lonDir} | Sea State 3 | Depth: 34m`;
      });
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      if (mapInstance) mapInstance.invalidateSize();
    });
  }

  // Render Potential Oil Spill Polygons
  function renderSpillPolygons() {
    if (!layers.spills) return;
    layers.spills.clearLayers();

    const spills = window.OilTraceData.spills;
    spills.forEach(spill => {
      // Create stylized slick polygon
      const polygon = L.polygon(spill.polygon, {
        color: '#f43f5e',
        weight: 2,
        opacity: 0.9,
        fillColor: '#f43f5e',
        fillOpacity: 0.38,
        dashArray: '4, 4',
        className: 'oil-spill-polygon'
      });

      // Slick Centroid Marker
      const centroidIcon = L.divIcon({
        className: 'spill-centroid-icon',
        html: `
          <div style="
            width: 14px; 
            height: 14px; 
            background: #f43f5e; 
            border: 2px solid #ffffff; 
            border-radius: 50%;
            box-shadow: 0 0 10px #f43f5e;
          "></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const centroidMarker = L.marker(spill.centroid, { icon: centroidIcon });

      // Drift Arrow Line
      const driftEndLat = spill.centroid[0] + 0.035 * Math.cos(spill.drift_vector.heading_deg * Math.PI / 180);
      const driftEndLon = spill.centroid[1] + 0.055 * Math.sin(spill.drift_vector.heading_deg * Math.PI / 180);
      const driftLine = L.polyline([spill.centroid, [driftEndLat, driftEndLon]], {
        color: '#06b6d4',
        weight: 2,
        dashArray: '3, 4',
        opacity: 0.8
      });

      // Interactive Popup
      const popupContent = `
        <div style="font-family: var(--font-sans); min-width: 250px; padding: 4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #1e293b; padding-bottom:6px;">
            <span style="font-size:0.7rem; font-weight:700; color:#f43f5e; text-transform:uppercase; letter-spacing:0.05em; background:rgba(244,63,94,0.15); padding:2px 6px; border-radius:3px;">
              Potential Oil Spill
            </span>
            <span style="font-family:var(--font-mono); font-size:0.72rem; color:#94a3b8;">${spill.id}</span>
          </div>
          
          <h4 style="font-size:0.92rem; font-weight:600; color:#ffffff; margin-bottom:6px;">${spill.name}</h4>
          <p style="font-size:0.75rem; color:#94a3b8; margin-bottom:10px;">${spill.zone}</p>

          <div style="background:#091120; border:1px solid #1c3359; border-radius:4px; padding:8px; display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px; font-family:var(--font-mono); font-size:0.75rem;">
            <div>
              <span style="display:block; font-size:0.65rem; color:#64748b; text-transform:uppercase;">Affected Area</span>
              <strong style="color:#ffffff;">${spill.area_sq_km} km²</strong>
            </div>
            <div>
              <span style="display:block; font-size:0.65rem; color:#64748b; text-transform:uppercase;">Confidence</span>
              <strong style="color:#06b6d4;">${spill.confidence_pct}%</strong>
            </div>
            <div>
              <span style="display:block; font-size:0.65rem; color:#64748b; text-transform:uppercase;">Uncertainty</span>
              <span style="color:#94a3b8;">± ${spill.uncertainty_pct}%</span>
            </div>
            <div>
              <span style="display:block; font-size:0.65rem; color:#64748b; text-transform:uppercase;">Sensor</span>
              <span style="color:#94a3b8;">SAR C-Band</span>
            </div>
          </div>

          <div style="display:flex; gap:8px;">
            <button onclick="window.OilTraceApp.navigateTo('satellite-analysis');" style="
              flex:1; background:#0284c7; border:none; color:#fff; font-size:0.75rem; font-weight:600; padding:6px; border-radius:4px; cursor:pointer;
            ">Satellite Scan</button>
            <button onclick="window.OilTraceApp.navigateTo('vessel-ranking');" style="
              flex:1; background:#1e293b; border:1px solid #334155; color:#cbd5e1; font-size:0.75rem; font-weight:600; padding:6px; border-radius:4px; cursor:pointer;
            ">Vessel Ranking</button>
          </div>
        </div>
      `;

      polygon.bindPopup(popupContent);
      centroidMarker.bindPopup(popupContent);

      layers.spills.addLayer(polygon);
      layers.spills.addLayer(centroidMarker);
      layers.spills.addLayer(driftLine);
    });
  }

  // Create SVG Ship Marker HTML rotated by heading
  function createShipIcon(heading, isCandidate, rank, score) {
    let color = '#10b981';
    let borderColor = '#059669';
    let glow = '';

    if (isCandidate) {
      if (rank === 1) {
        color = '#f59e0b';
        borderColor = '#ffffff';
        glow = 'filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.8));';
      } else if (rank === 2) {
        color = '#38bdf8';
        borderColor = '#ffffff';
        glow = 'filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.7));';
      } else {
        color = '#94a3b8';
        borderColor = '#ffffff';
      }
    }

    const svgHtml = `
      <div style="transform: rotate(${heading}deg); transform-origin: center; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; ${glow}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Nautical Ship Silhouette Arrow -->
          <path d="M12 2L19 19L12 16L5 19L12 2Z" fill="${color}" stroke="${borderColor}" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="12" cy="14" r="1.5" fill="#ffffff" />
        </svg>
      </div>
    `;

    return L.divIcon({
      className: 'marine-vessel-marker',
      html: svgHtml,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  // Render Candidate Vessels
  function renderCandidateVessels() {
    if (!layers.candidates) return;
    layers.candidates.clearLayers();

    const candidates = window.OilTraceData.candidateVessels;
    candidates.forEach(vessel => {
      const icon = createShipIcon(vessel.current_heading, true, vessel.rank, vessel.correlation_score);
      const marker = L.marker(vessel.current_pos, { icon: icon });

      // Click event selects vessel and displays trajectory
      marker.on('click', () => {
        activeTrajectoryVesselId = vessel.id;
        renderTrajectories();
      });

      const scoreColor = vessel.rank === 1 ? '#f43f5e' : (vessel.rank === 2 ? '#f59e0b' : '#38bdf8');

      const popupHtml = `
        <div style="font-family: var(--font-sans); min-width: 260px; padding: 4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #1e293b; padding-bottom:6px;">
            <span style="font-size:0.7rem; font-weight:700; color:${scoreColor}; text-transform:uppercase; letter-spacing:0.05em; background:rgba(245,158,11,0.15); padding:2px 6px; border-radius:3px;">
              Candidate Vessel #${vessel.rank}
            </span>
            <span style="font-family:var(--font-mono); font-size:0.72rem; color:#94a3b8;">${vessel.flag} [${vessel.flag_code}]</span>
          </div>

          <h4 style="font-size:0.95rem; font-weight:700; color:#ffffff; margin-bottom:2px;">${vessel.name}</h4>
          <p style="font-size:0.75rem; color:#94a3b8; margin-bottom:10px;">${vessel.type} • MMSI: ${vessel.mmsi}</p>

          <div style="background:#091120; border:1px solid #1c3359; border-radius:4px; padding:8px; display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px; font-family:var(--font-mono); font-size:0.75rem;">
            <div>
              <span style="display:block; font-size:0.65rem; color:#64748b; text-transform:uppercase;">Correlation</span>
              <strong style="color:${scoreColor}; font-size:0.9rem;">${vessel.correlation_score}%</strong>
            </div>
            <div>
              <span style="display:block; font-size:0.65rem; color:#64748b; text-transform:uppercase;">Speed / Heading</span>
              <span style="color:#ffffff;">${vessel.current_speed_kts} kts / ${vessel.current_heading}°</span>
            </div>
            <div>
              <span style="display:block; font-size:0.65rem; color:#64748b; text-transform:uppercase;">Distance to Spill</span>
              <span style="color:#94a3b8;">${vessel.distance_nm} nm</span>
            </div>
            <div>
              <span style="display:block; font-size:0.65rem; color:#64748b; text-transform:uppercase;">Time Delta</span>
              <span style="color:#94a3b8;">${vessel.time_proximity_min} min</span>
            </div>
          </div>

          <div style="font-size:0.73rem; color:#cbd5e1; margin-bottom:10px; background:rgba(15,23,42,0.8); padding:6px; border-radius:4px; border-left:3px solid ${scoreColor};">
            <strong>Evidence:</strong> ${vessel.speed_anomaly}
          </div>

          <div style="display:flex; gap:8px;">
            <button onclick="window.OilTraceApp.openEvidenceModal('${vessel.id}');" style="
              flex:1; background:#0284c7; border:none; color:#fff; font-size:0.75rem; font-weight:600; padding:6px; border-radius:4px; cursor:pointer;
            ">Evidence Dossier</button>
            <button onclick="window.OilTraceMap.highlightTrajectory('${vessel.id}');" style="
              flex:1; background:#1e293b; border:1px solid #334155; color:#cbd5e1; font-size:0.75rem; font-weight:600; padding:6px; border-radius:4px; cursor:pointer;
            ">Show Track</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      layers.candidates.addLayer(marker);
    });
  }

  // Render Ambient Marine Traffic
  function renderAmbientTraffic() {
    if (!layers.ambient) return;
    layers.ambient.clearLayers();

    const ambient = window.OilTraceData.ambientVessels;
    ambient.forEach(vessel => {
      const icon = createShipIcon(vessel.heading, false, 0, 0);
      const marker = L.marker(vessel.pos, { icon: icon });

      const popupHtml = `
        <div style="font-family: var(--font-sans); min-width: 200px; padding: 4px;">
          <div style="font-size:0.68rem; font-weight:700; color:#10b981; text-transform:uppercase; margin-bottom:4px;">
            Normal AIS Traffic
          </div>
          <h4 style="font-size:0.9rem; font-weight:600; color:#ffffff; margin-bottom:2px;">${vessel.name}</h4>
          <p style="font-size:0.74rem; color:#94a3b8; margin-bottom:6px;">${vessel.type} • MMSI: ${vessel.mmsi}</p>
          <div style="font-family:var(--font-mono); font-size:0.72rem; color:#cbd5e1;">
            Speed: ${vessel.speed} kts | Heading: ${vessel.heading}°
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      layers.ambient.addLayer(marker);
    });
  }

  // Render Vessel Historical Trajectories
  function renderTrajectories() {
    if (!layers.trajectories) return;
    layers.trajectories.clearLayers();
    if (!showTrajectories) return;

    const candidates = window.OilTraceData.candidateVessels;
    
    candidates.forEach(vessel => {
      if (!vessel.trajectory || vessel.trajectory.length === 0) return;
      
      const isSelected = vessel.id === activeTrajectoryVesselId;
      const trackPoints = vessel.trajectory.map(pt => [pt.lat, pt.lon]);
      
      // Polyline styling
      const polyline = L.polyline(trackPoints, {
        color: isSelected ? '#f59e0b' : '#38bdf8',
        weight: isSelected ? 3.5 : 1.5,
        opacity: isSelected ? 0.95 : 0.45,
        dashArray: isSelected ? '5, 5' : '2, 6'
      });

      layers.trajectories.addLayer(polyline);

      // Trajectory Waypoint Fixes with Timestamps
      if (isSelected) {
        vessel.trajectory.forEach((pt, index) => {
          const isAtSlick = index === 3 || index === 4;
          const pointIcon = L.divIcon({
            className: 'trajectory-waypoint',
            html: `
              <div style="
                width: ${isAtSlick ? '10px' : '7px'};
                height: ${isAtSlick ? '10px' : '7px'};
                background-color: ${isAtSlick ? '#f43f5e' : '#f59e0b'};
                border: 1.5px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 0 6px ${isAtSlick ? '#f43f5e' : '#f59e0b'};
              "></div>
            `,
            iconSize: [10, 10],
            iconAnchor: [5, 5]
          });

          const pointMarker = L.marker([pt.lat, pt.lon], { icon: pointIcon });
          pointMarker.bindTooltip(`
            <div style="font-family: var(--font-mono); font-size: 0.72rem; padding: 2px;">
              <strong>${pt.time}</strong><br>
              Speed: ${pt.speed} kts<br>
              Heading: ${pt.heading}°
              ${isAtSlick ? '<br><span style="color:#f43f5e; font-weight:700;">[Within Slick Radius]</span>' : ''}
            </div>
          `, { direction: 'top', offset: [0, -5] });

          layers.trajectories.addLayer(pointMarker);
        });
      }
    });
  }

  // Highlight specific vessel trajectory
  function highlightTrajectory(vesselId) {
    activeTrajectoryVesselId = vesselId;
    renderTrajectories();
    
    // Zoom or pan to vessel
    const vessel = window.OilTraceData.candidateVessels.find(v => v.id === vesselId);
    if (vessel && mapInstance) {
      mapInstance.flyTo(vessel.current_pos, 12, { duration: 1.2 });
    }
  }

  // Toggle Trajectories on/off
  function toggleTrajectories() {
    showTrajectories = !showTrajectories;
    renderTrajectories();
    return showTrajectories;
  }

  // Tactical Nautical Vector Chart Fallback (when Leaflet CDN is unavailable)
  function initFallbackVectorChart(container) {
    container.innerHTML = '<canvas id="tactical-vector-canvas" style="width:100%; height:100%; display:block;"></canvas>';
    const canvas = document.getElementById('tactical-vector-canvas');
    if (!canvas) return;

    function resize() {
      canvas.width = container.clientWidth || 900;
      canvas.height = container.clientHeight || 550;
      drawVectorChart(canvas);
    }

    window.addEventListener('resize', resize);
    setTimeout(resize, 50);
  }

  function drawVectorChart(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Bounds for Dover Strait: lat 51.05 to 51.35, lon 1.30 to 1.90
    const minLat = 51.05, maxLat = 51.36;
    const minLon = 1.30, maxLon = 1.90;

    function project(lat, lon) {
      const x = ((lon - minLon) / (maxLon - minLon)) * w;
      const y = ((maxLat - lat) / (maxLat - minLat)) * h;
      return [x, y];
    }

    // 1. Abyss Background
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, w, h);

    // 2. Nautical Grid Lines & Coordinates
    ctx.strokeStyle = '#0f223f';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    for (let lat = 51.10; lat <= 51.35; lat += 0.05) {
      const [_, y] = project(lat, minLon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${lat.toFixed(2)}° N`, 10, y - 4);
    }

    for (let lon = 1.40; lon <= 1.85; lon += 0.10) {
      const [x, _] = project(maxLat, lon);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${lon.toFixed(2)}° E`, x + 4, h - 10);
    }
    ctx.setLineDash([]);

    // 3. Draw Dover Strait Shipping Lanes (Separation Scheme)
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    const [lx1, ly1] = project(51.10, 1.45);
    const [lx2, ly2] = project(51.30, 1.80);
    ctx.beginPath();
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx2, ly2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Draw Potential Oil Spill Polygon
    const spill = window.OilTraceData.spills[0];
    if (spill && spill.polygon) {
      ctx.save();
      ctx.fillStyle = 'rgba(244, 63, 94, 0.38)';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      spill.polygon.forEach((pt, i) => {
        const [px, py] = project(pt[0], pt[1]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Spill Label
      const [cx, cy] = project(spill.centroid[0], spill.centroid[1]);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText('POTENTIAL OIL SPILL [14.28 km²]', cx - 80, cy - 14);
      ctx.restore();
    }

    // 5. Draw Trajectories
    if (showTrajectories) {
      window.OilTraceData.candidateVessels.forEach(v => {
        if (!v.trajectory) return;
        const isSel = v.id === activeTrajectoryVesselId;
        ctx.strokeStyle = isSel ? '#f59e0b' : 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = isSel ? 2.5 : 1.2;
        ctx.setLineDash(isSel ? [4, 4] : [2, 4]);

        ctx.beginPath();
        v.trajectory.forEach((pt, i) => {
          const [px, py] = project(pt.lat, pt.lon);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // 6. Draw Candidate Vessels
    window.OilTraceData.candidateVessels.forEach(v => {
      const [vx, vy] = project(v.current_pos[0], v.current_pos[1]);
      const color = v.rank === 1 ? '#f59e0b' : (v.rank === 2 ? '#38bdf8' : '#94a3b8');

      ctx.save();
      ctx.translate(vx, vy);
      ctx.rotate((v.current_heading * Math.PI) / 180);

      // Ship Arrow
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(6, 8);
      ctx.lineTo(0, 5);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Vessel Name Label
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText(v.name, vx + 10, vy + 4);
      ctx.fillStyle = color;
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${v.correlation_score}% Match`, vx + 10, vy + 16);
    });

    // 7. Tactical Status Badge
    ctx.fillStyle = 'rgba(9, 17, 32, 0.85)';
    ctx.fillRect(w - 220, 15, 205, 30);
    ctx.strokeStyle = '#1c3359';
    ctx.strokeRect(w - 220, 15, 205, 30);
    ctx.fillStyle = '#06b6d4';
    ctx.font = '600 10px JetBrains Mono, monospace';
    ctx.fillText('TACTICAL VECTOR RADAR: ACTIVE', w - 210, 34);
  }

  // Center on Primary Spill
  function centerOnPrimarySpill() {
    if (!mapInstance) return;
    const primarySpill = window.OilTraceData.spills[0];
    if (primarySpill) {
      mapInstance.flyTo(primarySpill.centroid, 12, { duration: 1.2 });
    }
  }

  // Switch Map Tiles according to theme (Dark / Light)
  function setTheme(theme) {
    currentTheme = theme;
    if (mapInstance && typeof L !== 'undefined') {
      if (tileLayer) {
        mapInstance.removeLayer(tileLayer);
      }
      const tileUrl = theme === 'light'
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

      tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 18,
        subdomains: 'abcd'
      });
      tileLayer.addTo(mapInstance);
      tileLayer.bringToBack();
    }

    const canvas = document.getElementById('tactical-vector-canvas');
    if (canvas) {
      drawVectorChart(canvas);
    }
  }

  return {
    init,
    highlightTrajectory,
    toggleTrajectories,
    centerOnPrimarySpill,
    renderSpillPolygons,
    setTheme,
    invalidate: function() {
      if (mapInstance) mapInstance.invalidateSize();
    }
  };
})();
