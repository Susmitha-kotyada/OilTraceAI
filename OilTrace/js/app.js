/**
 * OIL TRACE AI - MAIN APPLICATION CONTROLLER
 * Coordinates UI views, Landing Page transitions, Light/Dark Mode,
 * Satellite Analysis to Dashboard live image synchronization, and UTC telemetry.
 */

window.OilTraceApp = (function() {
  let activeView = 'dashboard';
  let currentTheme = localStorage.getItem('oil_trace_theme') || 'dark';

  function init() {
    initTheme();
    setupNavigation();
    setupUTCClock();
    setupLandingPage();
    setupThemeToggle();
    renderRecentAnalysisFeed();
    setupGlobalEvents();

    // Initialize submodules
    if (window.OilTraceAnalyzer) window.OilTraceAnalyzer.init();
    if (window.OilTraceRanking) window.OilTraceRanking.init();
    if (window.OilTraceAlerts) window.OilTraceAlerts.init();

    refreshDashboard();
  }

  // Initialize Theme (Dark / Light)
  function initTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcons();
  }

  function setupThemeToggle() {
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', toggleTheme);
    });
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('oil_trace_theme', currentTheme);
    updateThemeIcons();

    // Notify map to switch tiles
    if (window.OilTraceMap && window.OilTraceMap.setTheme) {
      window.OilTraceMap.setTheme(currentTheme);
    }
  }

  function updateThemeIcons() {
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(btn => {
      btn.setAttribute('title', `Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Mode`);
    });
  }

  // Setup Landing Page & App Launching
  function setupLandingPage() {
    const launchBtns = document.querySelectorAll('.btn-launch-platform');
    const returnLandingBtns = document.querySelectorAll('.btn-return-landing');

    launchBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        launchPlatform();
      });
    });

    returnLandingBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        showLandingPage();
      });
    });
  }

  // Transition from Landing Page to Main Platform
  function launchPlatform(targetTab = 'dashboard') {
    const landingView = document.getElementById('landing-page-view');
    const appContainer = document.getElementById('app-container');

    if (landingView) landingView.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';

    // Initialize Map on first launch if needed
    if (window.OilTraceMap) {
      window.OilTraceMap.init();
      setTimeout(() => {
        window.OilTraceMap.invalidate();
      }, 150);
    }

    navigateTo(targetTab);
  }

  // Return from Platform to Landing Page
  function showLandingPage() {
    const landingView = document.getElementById('landing-page-view');
    const appContainer = document.getElementById('app-container');

    if (appContainer) appContainer.style.display = 'none';
    if (landingView) {
      landingView.style.display = 'flex';
      landingView.scrollTop = 0;
    }
  }

  // Setup Sidebar Navigation
  function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetView = item.getAttribute('data-view');
        navigateTo(targetView);
      });
    });
  }

  // Navigate between views
  function navigateTo(viewId) {
    if (!viewId) return;

    // Update Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update View Containers
    document.querySelectorAll('.app-view').forEach(view => {
      if (view.id === `view-${viewId}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    activeView = viewId;

    // Update Top Header Breadcrumb
    const breadcrumbElem = document.getElementById('top-breadcrumb-current');
    if (breadcrumbElem) {
      const titles = {
        'dashboard': 'Operational Maritime Dashboard',
        'satellite-analysis': 'Satellite Imagery Analysis & Detection',
        'vessel-ranking': 'AIS Correlation & Vessel Ranking',
        'alerts': 'Maritime Alerts & Anomalies Feed'
      };
      breadcrumbElem.textContent = titles[viewId] || 'Overview';
    }

    // Refresh views on navigation
    if (viewId === 'dashboard') {
      refreshDashboard();
      if (window.OilTraceMap) {
        setTimeout(() => {
          window.OilTraceMap.invalidate();
        }, 120);
      }
    } else if (viewId === 'vessel-ranking') {
      if (window.OilTraceRanking && window.OilTraceRanking.renderTable) {
        window.OilTraceRanking.renderTable();
      }
    } else if (viewId === 'alerts') {
      if (window.OilTraceAlerts && window.OilTraceAlerts.renderAlerts) {
        window.OilTraceAlerts.renderAlerts();
      }
    }
  }

  // Setup Live UTC Clock
  function setupUTCClock() {
    const clocks = [
      document.getElementById('live-utc-clock'),
      document.getElementById('landing-utc-clock')
    ];

    function update() {
      const now = new Date();
      const utcString = now.toUTCString().replace('GMT', 'UTC');
      clocks.forEach(c => {
        if (c) c.textContent = utcString;
      });
    }

    update();
    setInterval(update, 1000);
  }

  // ==========================================================================
  // SATELLITE ANALYSIS TO DASHBOARD SYNCHRONIZATION
  // ==========================================================================
  let dashboardImageViewMode = 'analyzed'; // 'analyzed' or 'raw'

  function refreshDashboard() {
    const activeSat = window.OilTraceData.activeSatelliteImage;
    const candidates = window.OilTraceData.candidateVessels;
    const topCandidate = (candidates && candidates.length > 0) ? candidates[0] : null;

    // 1. Update Satellite Image Display
    const imgElem = document.getElementById('dashboard-main-satellite-img');
    if (imgElem && activeSat) {
      if (dashboardImageViewMode === 'raw' && activeSat.originalDataUrl) {
        imgElem.src = activeSat.originalDataUrl;
      } else if (activeSat.analyzedDataUrl) {
        imgElem.src = activeSat.analyzedDataUrl;
      } else if (activeSat.thumbnail) {
        imgElem.src = activeSat.thumbnail;
      }
    }

    // 2. Update Scene Name Badge
    const sceneBadge = document.getElementById('dash-active-scene-badge');
    if (sceneBadge && activeSat) {
      sceneBadge.textContent = activeSat.sensor || activeSat.name || "Sentinel-1C SAR (VV-Pol)";
    }

    // 3. Update HUD Floating Badges
    const hudSpillBadge = document.getElementById('dash-hud-spill-badge');
    if (hudSpillBadge && activeSat) {
      hudSpillBadge.innerHTML = `
        <span class="status-dot" style="background:#f43f5e; box-shadow:0 0 6px #f43f5e;"></span>
        POTENTIAL OIL SPILL [${activeSat.area_sq_km} km² | ${activeSat.confidence_pct}% Conf]
      `;
    }

    const hudVesselsBadge = document.getElementById('dash-hud-vessels-badge');
    if (hudVesselsBadge && activeSat) {
      const vCount = activeSat.vesselTargetsCount !== undefined ? activeSat.vesselTargetsCount : 2;
      hudVesselsBadge.innerHTML = `
        <span class="status-dot" style="background:#06b6d4; box-shadow:0 0 6px #06b6d4;"></span>
        ${vCount} VESSEL TARGETS IDENTIFIED
      `;
    }

    const hudSensorTag = document.getElementById('dash-hud-sensor-tag');
    if (hudSensorTag && activeSat) {
      hudSensorTag.textContent = activeSat.sensor || "Sentinel-1C C-Band SAR (10m Resolution)";
    }

    const hudCoordsTag = document.getElementById('dash-hud-coords-tag');
    if (hudCoordsTag && activeSat) {
      hudCoordsTag.textContent = activeSat.location || "51° 13' 06\" N, 001° 37' 26\" E";
    }

    // 4. Update Quick Metrics Ribbon
    const metricArea = document.getElementById('dash-metric-area');
    if (metricArea && activeSat) metricArea.textContent = `${activeSat.area_sq_km} km²`;

    const metricConf = document.getElementById('dash-metric-confidence');
    if (metricConf && activeSat) metricConf.textContent = `${activeSat.confidence_pct}%`;

    const metricUncert = document.getElementById('dash-metric-uncertainty');
    if (metricUncert && activeSat) metricUncert.textContent = `± ${activeSat.uncertainty_pct}%`;

    const metricTargets = document.getElementById('dash-metric-targets');
    if (metricTargets && activeSat) {
      const vCount = activeSat.vesselTargetsCount !== undefined ? activeSat.vesselTargetsCount : 2;
      metricTargets.textContent = `${vCount} Ship Targets`;
    }

    // 5. Update Top Correlated Candidate Vessel Spotlight
    if (topCandidate) {
      const nameElem = document.getElementById('dash-top-candidate-name');
      if (nameElem) nameElem.textContent = topCandidate.name;

      const subElem = document.getElementById('dash-top-candidate-sub');
      if (subElem) subElem.textContent = `${topCandidate.type} • Flag: ${topCandidate.flag || topCandidate.flag_code} • MMSI: ${topCandidate.mmsi}`;

      const scoreElem = document.getElementById('dash-top-candidate-score');
      if (scoreElem) scoreElem.textContent = `${topCandidate.correlation_score}%`;

      const barElem = document.getElementById('dash-top-candidate-bar');
      if (barElem) {
        barElem.style.width = `${topCandidate.correlation_score}%`;
        barElem.className = 'score-bar-fill ' + (topCandidate.correlation_score >= 80 ? 'meter-high' : 'meter-elevated');
      }

      const distElem = document.getElementById('dash-top-candidate-dist');
      if (distElem) distElem.textContent = `${topCandidate.distance_nm} nm (${topCandidate.distance_km} km)`;

      const timeElem = document.getElementById('dash-top-candidate-time');
      if (timeElem) timeElem.textContent = topCandidate.time_proximity_text || `${topCandidate.time_proximity_min} min`;

      const routeElem = document.getElementById('dash-top-candidate-route');
      if (routeElem) routeElem.textContent = `${topCandidate.route_similarity_pct}% Match`;

      const speedElem = document.getElementById('dash-top-candidate-speed');
      if (speedElem) speedElem.textContent = `${topCandidate.speed_kts_at_slick} kts (${topCandidate.speed_anomaly ? 'Speed dip' : 'Cruise'})`;

      const noteElem = document.getElementById('dash-top-candidate-note');
      if (noteElem) {
        if (topCandidate.evidence_breakdown && topCandidate.evidence_breakdown.wake_match) {
          noteElem.textContent = topCandidate.evidence_breakdown.wake_match;
        } else {
          noteElem.textContent = `Candidate vessel transited coordinates colinear with detected slick dispersion axis (${topCandidate.heading_deg_at_slick || topCandidate.current_heading}°).`;
        }
      }

      const riskElem = document.getElementById('dash-top-candidate-risk');
      if (riskElem) {
        riskElem.textContent = topCandidate.risk_level || (topCandidate.correlation_score >= 80 ? "HIGH PRIORITY CANDIDATE" : "ELEVATED CANDIDATE");
      }
    }

    // 6. Update Key Statistics Bar
    const spills = window.OilTraceData.spills;
    let totalArea = 0;
    spills.forEach(s => totalArea += parseFloat(s.area_sq_km || 0));
    const statAreaElem = document.getElementById('stat-total-affected-area');
    if (statAreaElem) {
      statAreaElem.innerHTML = `${totalArea.toFixed(2)} <span style="font-size: 1rem; color: var(--text-secondary); font-weight: 500;">km²</span>`;
    }

    // 7. Update Recent Analysis List
    renderRecentAnalysisFeed();
  }

  function syncDashboardWithAnalysis(syncData) {
    if (!syncData) return;

    const spills = window.OilTraceData.spills;
    
    // Update or prepend the primary active spill with the new analyzed image data
    spills[0].thumbnail = syncData.thumbnail || syncData.analyzedDataUrl || syncData.originalDataUrl;
    spills[0].name = syncData.name;
    spills[0].zone = syncData.zone;
    spills[0].area_sq_km = syncData.area_sq_km;
    spills[0].area_hectares = syncData.area_hectares || Math.round(syncData.area_sq_km * 100);
    spills[0].confidence_pct = syncData.confidence_pct;
    spills[0].uncertainty_pct = syncData.uncertainty_pct;
    spills[0].sensor = syncData.sensor;
    spills[0].timestamp = syncData.timestamp || new Date().toISOString();
    if (syncData.location) spills[0].centroid_text = syncData.location;
    spills[0].isLiveAnalyzed = true;

    // Refresh Dashboard card and spotlight immediately
    refreshDashboard();

    // Show dynamic sync banner on Dashboard
    showSyncNotificationBanner(syncData);

    // Refresh map overlays so popups reflect the new analysis
    if (window.OilTraceMap && window.OilTraceMap.renderSpillPolygons) {
      window.OilTraceMap.renderSpillPolygons();
    }
  }

  // Show a clean notification banner on Dashboard when analysis is synchronized
  function showSyncNotificationBanner(syncData) {
    const banner = document.getElementById('dashboard-sync-banner');
    const textElem = document.getElementById('dashboard-sync-banner-text');
    if (!banner || !textElem) return;

    textElem.innerHTML = `
      <strong>Live Satellite Analysis Synced:</strong> 
      ${syncData.name} — <span style="color:var(--spill-critical); font-family:var(--font-mono); font-weight:700;">${syncData.area_sq_km} km²</span> detected 
      (Confidence: <span style="color:var(--radar-cyan); font-family:var(--font-mono); font-weight:700;">${syncData.confidence_pct}%</span>)
    `;
    banner.style.display = 'flex';

    // Auto-fade banner after 8 seconds
    setTimeout(() => {
      if (banner) banner.style.display = 'none';
    }, 8000);
  }

  // Generate fallback synthetic thumbnail data URL for presets
  function getSyntheticThumbnail(spill) {
    if (spill.thumbnail) return spill.thumbnail;

    // Create an offscreen canvas to generate a miniature preview
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    // Dark nautical ocean background
    ctx.fillStyle = '#081224';
    ctx.fillRect(0, 0, 120, 80);

    // Wave clutter lines
    ctx.strokeStyle = '#122544';
    ctx.lineWidth = 1;
    for (let i = 0; i < 80; i += 8) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(120, i);
      ctx.stroke();
    }

    // Slick plume
    ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(60, 42, 38, 16, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Candidate vessel point target
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(86, 26, 3, 3);

    return canvas.toDataURL('image/jpeg', 0.8);
  }

  // Render Recent Analysis list on Dashboard with Image Thumbnails
  function renderRecentAnalysisFeed() {
    const container = document.getElementById('recent-analysis-feed');
    if (!container) return;

    const spills = window.OilTraceData.spills;
    container.innerHTML = '';

    spills.forEach((spill, index) => {
      const card = document.createElement('div');
      card.className = `analysis-item-card ${spill.isLiveAnalyzed ? 'selected' : ''}`;

      // Get thumbnail
      const thumbSrc = spill.thumbnail || getSyntheticThumbnail(spill);

      // Find top candidate vessel for this spill
      const topCandidate = window.OilTraceData.candidateVessels[0];
      const sensorShort = spill.sensor ? spill.sensor.split(' ')[0] : 'SAR';

      card.innerHTML = `
        <div class="analysis-item-card-layout">
          <div class="analysis-thumb-wrapper">
            <img src="${thumbSrc}" class="analysis-thumb-img" alt="${spill.name}">
            <span class="analysis-thumb-badge">${sensorShort}</span>
          </div>
          
          <div class="analysis-content-wrapper">
            <div class="analysis-item-top">
              <span class="analysis-zone">${spill.name}</span>
              <span class="analysis-time" style="font-family:var(--font-mono);">${spill.id}</span>
            </div>
            
            <div style="font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 4px;">
              ${spill.zone}
            </div>

            <div class="analysis-meta">
              <div class="analysis-meta-col">
                <span class="analysis-meta-label">Affected Area</span>
                <span class="analysis-meta-val critical">${spill.area_sq_km} km²</span>
              </div>
              <div class="analysis-meta-col">
                <span class="analysis-meta-label">Confidence</span>
                <span class="analysis-meta-val cyan">${spill.confidence_pct}%</span>
              </div>
              <div class="analysis-meta-col">
                <span class="analysis-meta-label">Sensor</span>
                <span class="analysis-meta-val" style="font-size:0.68rem;">${sensorShort}</span>
              </div>
              <div class="analysis-meta-col">
                <span class="analysis-meta-label">Uncertainty</span>
                <span class="analysis-meta-val" style="font-size:0.68rem;">± ${spill.uncertainty_pct}%</span>
              </div>
            </div>

            <div class="analysis-card-footer">
              <span class="candidate-match-tag">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L19 19L12 16L5 19L12 2Z"></path>
                </svg>
                Top Match: ${topCandidate.name} (${topCandidate.correlation_score}%)
              </span>
              <span style="color: var(--radar-cyan); font-weight: 600; font-size: 0.72rem;">Inspect →</span>
            </div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        navigateTo('satellite-analysis');
      });

      container.appendChild(card);
    });
  }

  // Setup Global Navigation / Quick buttons
  function setupGlobalEvents() {
    // Map overlay toggle buttons in dashboard
    const btnToggleTracks = document.getElementById('btn-toggle-tracks');
    if (btnToggleTracks) {
      btnToggleTracks.addEventListener('click', () => {
        const state = window.OilTraceMap.toggleTrajectories();
        btnToggleTracks.classList.toggle('active', state);
      });
    }

    const btnCenterSpill = document.getElementById('btn-center-spill');
    if (btnCenterSpill) {
      btnCenterSpill.addEventListener('click', () => {
        window.OilTraceMap.centerOnPrimarySpill();
      });
    }

    // View Switching in Satellite Analysis
    const btnViewSideBySide = document.getElementById('btn-view-side-by-side');
    const btnViewSlider = document.getElementById('btn-view-slider');
    const sideBySideContainer = document.getElementById('side-by-side-display');
    const sliderContainer = document.getElementById('slider-display');

    if (btnViewSideBySide && btnViewSlider) {
      btnViewSideBySide.addEventListener('click', () => {
        btnViewSideBySide.classList.add('active');
        btnViewSlider.classList.remove('active');
        if (sideBySideContainer) sideBySideContainer.style.display = 'grid';
        if (sliderContainer) sliderContainer.style.display = 'none';
      });

      btnViewSlider.addEventListener('click', () => {
        btnViewSlider.classList.add('active');
        btnViewSideBySide.classList.remove('active');
        if (sideBySideContainer) sideBySideContainer.style.display = 'none';
        if (sliderContainer) sliderContainer.style.display = 'block';
      });
    }

    // Dashboard Image View Controls (Analyzed vs Raw)
    const btnShowAnalyzed = document.getElementById('dash-btn-show-analyzed');
    const btnShowRaw = document.getElementById('dash-btn-show-raw');
    const dashImg = document.getElementById('dashboard-main-satellite-img');

    if (btnShowAnalyzed && btnShowRaw && dashImg) {
      btnShowAnalyzed.addEventListener('click', () => {
        dashboardImageViewMode = 'analyzed';
        btnShowAnalyzed.classList.add('active');
        btnShowRaw.classList.remove('active');
        const sat = window.OilTraceData.activeSatelliteImage;
        if (sat && (sat.analyzedDataUrl || sat.thumbnail)) {
          dashImg.src = sat.analyzedDataUrl || sat.thumbnail;
        }
      });

      btnShowRaw.addEventListener('click', () => {
        dashboardImageViewMode = 'raw';
        btnShowRaw.classList.add('active');
        btnShowAnalyzed.classList.remove('active');
        const sat = window.OilTraceData.activeSatelliteImage;
        if (sat && (sat.originalDataUrl || sat.thumbnail)) {
          dashImg.src = sat.originalDataUrl || sat.thumbnail;
        }
      });
    }

    // Dashboard Open Dossier Button
    const btnOpenDossier = document.getElementById('dash-btn-open-dossier');
    if (btnOpenDossier) {
      btnOpenDossier.addEventListener('click', () => {
        const candidates = window.OilTraceData.candidateVessels;
        if (candidates && candidates.length > 0) {
          openEvidenceModal(candidates[0].id);
        }
      });
    }

    // Overlay checkboxes in Satellite Analysis
    const chkMask = document.getElementById('chk-overlay-mask');
    const chkContour = document.getElementById('chk-overlay-contour');
    const chkCentroid = document.getElementById('chk-overlay-centroid');
    const chkBBox = document.getElementById('chk-overlay-bbox');
    const chkVessels = document.getElementById('chk-overlay-vessels');

    if (chkMask) chkMask.addEventListener('change', (e) => window.OilTraceAnalyzer.setOverlayOption('showMask', e.target.checked));
    if (chkContour) chkContour.addEventListener('change', (e) => window.OilTraceAnalyzer.setOverlayOption('showContour', e.target.checked));
    if (chkCentroid) chkCentroid.addEventListener('change', (e) => window.OilTraceAnalyzer.setOverlayOption('showCentroid', e.target.checked));
    if (chkBBox) chkBBox.addEventListener('change', (e) => window.OilTraceAnalyzer.setOverlayOption('showBBox', e.target.checked));
    if (chkVessels) chkVessels.addEventListener('change', (e) => window.OilTraceAnalyzer.setOverlayOption('showVessels', e.target.checked));
  }

  // Open evidence modal shortcut
  function openEvidenceModal(vesselId) {
    navigateTo('vessel-ranking');
    if (window.OilTraceRanking) {
      window.OilTraceRanking.openEvidence(vesselId);
    }
  }

  return {
    init,
    navigateTo,
    launchPlatform,
    showLandingPage,
    toggleTheme,
    syncDashboardWithAnalysis,
    openEvidenceModal
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.OilTraceApp.init();
});
