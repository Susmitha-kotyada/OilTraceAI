/**
 * OIL TRACE AI - AIS CORRELATION & VESSEL RANKING ENGINE
 * Correlates detected Potential Oil Spill with spatial-temporal AIS vessel data.
 * Ranks candidate vessels using 5 parameters: Distance, Time proximity,
 * Route/trajectory similarity, Speed, and Heading.
 */

window.OilTraceRanking = (function() {
  let currentFilter = 'all';
  let currentSort = 'score-desc';
  let activeVesselId = null;

  function init() {
    setupControls();
    renderTable();
  }

  function setupControls() {
    // Filter buttons (All, Tankers, Cargo, Container)
    const filterBtns = document.querySelectorAll('.ranking-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter');
        renderTable();
      });
    });

    // Sort selector
    const sortSelect = document.getElementById('ranking-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderTable();
      });
    }

    // Modal Close button & backdrop click
    const modalBackdrop = document.getElementById('evidence-modal-backdrop');
    const modalCloseBtn = document.getElementById('btn-close-evidence-modal');

    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeModal);
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    // ESC key closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  // Filter & Sort Candidate Vessels
  function getFilteredCandidates() {
    let list = [...window.OilTraceData.candidateVessels];

    // Filter by vessel type
    if (currentFilter === 'tankers') {
      list = list.filter(v => v.type.toLowerCase().includes('tanker'));
    } else if (currentFilter === 'cargo') {
      list = list.filter(v => v.type.toLowerCase().includes('cargo') || v.type.toLowerCase().includes('bulk'));
    } else if (currentFilter === 'high-risk') {
      list = list.filter(v => v.correlation_score >= 70);
    }

    // Sort
    list.sort((a, b) => {
      if (currentSort === 'score-desc') return b.correlation_score - a.correlation_score;
      if (currentSort === 'score-asc') return a.correlation_score - b.correlation_score;
      if (currentSort === 'distance-asc') return a.distance_nm - b.distance_nm;
      if (currentSort === 'time-asc') return Math.abs(a.time_proximity_min) - Math.abs(b.time_proximity_min);
      if (currentSort === 'trajectory-desc') return b.route_similarity_pct - a.route_similarity_pct;
      return 0;
    });

    return list;
  }

  // Render Table
  function renderTable() {
    const tbody = document.getElementById('vessel-ranking-tbody');
    if (!tbody) return;

    const candidates = getFilteredCandidates();
    tbody.innerHTML = '';

    if (candidates.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">
            No candidate vessels match the selected filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    candidates.forEach((vessel, index) => {
      const tr = document.createElement('tr');
      if (vessel.rank === 1) {
        tr.classList.add('critical-candidate');
      }

      // Rank Badge Styling
      let rankClass = 'rank-normal';
      if (vessel.rank === 1) rankClass = 'rank-1';
      else if (vessel.rank === 2) rankClass = 'rank-2';
      else if (vessel.rank === 3) rankClass = 'rank-3';

      // Meter styling
      let meterClass = 'meter-low';
      let scoreClass = 'low';
      if (vessel.correlation_score >= 80) {
        meterClass = 'meter-high';
        scoreClass = 'high';
      } else if (vessel.correlation_score >= 60) {
        meterClass = 'meter-elevated';
        scoreClass = 'elevated';
      } else if (vessel.correlation_score >= 40) {
        meterClass = 'meter-moderate';
        scoreClass = 'moderate';
      }

      tr.innerHTML = `
        <td>
          <span class="rank-badge ${rankClass}">${vessel.rank}</span>
        </td>
        <td>
          <div class="vessel-name-cell">
            <span class="vessel-name">
              ${vessel.name}
              <span style="font-size:0.7rem; font-weight:500; color:var(--text-muted); font-family:var(--font-mono); background:var(--bg-surface); padding:1px 5px; border-radius:3px;">
                ${vessel.flag_code}
              </span>
            </span>
            <div class="vessel-identifiers">
              <span>MMSI: ${vessel.mmsi}</span>
              <span>•</span>
              <span>IMO: ${vessel.imo}</span>
            </div>
          </div>
        </td>
        <td>
          <span style="font-size:0.78rem; font-weight:500; color:var(--text-primary);">${vessel.type}</span>
          <div style="font-size:0.68rem; color:var(--text-muted); font-family:var(--font-mono);">${vessel.origin} → ${vessel.destination}</div>
        </td>
        <td>
          <div class="correlation-score-bar-wrapper">
            <div class="correlation-meter">
              <div class="meter-fill ${meterClass}" style="width: ${vessel.correlation_score}%"></div>
            </div>
            <span class="score-text ${scoreClass}">${vessel.correlation_score}%</span>
          </div>
          <div style="font-size:0.68rem; color:var(--text-muted);">${vessel.risk_level}</div>
        </td>
        <td>
          <div class="telemetry-cell">${vessel.distance_nm} nm <span class="telemetry-sub">(${vessel.distance_km} km)</span></div>
          <div class="telemetry-sub" style="color:var(--radar-cyan);">CPA: ${vessel.evidence_breakdown.cpa_distance_nm} nm</div>
        </td>
        <td>
          <div class="telemetry-cell">${vessel.time_proximity_text}</div>
          <div class="telemetry-sub">${vessel.evidence_breakdown.cpa_time}</div>
        </td>
        <td>
          <div class="telemetry-cell">${vessel.current_speed_kts} kts / ${vessel.current_heading}°</div>
          <div class="telemetry-sub" style="max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${vessel.speed_anomaly}
          </div>
        </td>
        <td style="text-align: right;">
          <button class="btn-evidence-view" onclick="event.stopPropagation(); window.OilTraceRanking.openEvidence('${vessel.id}');">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Evidence Dossier
          </button>
        </td>
      `;

      // Row click opens modal as well
      tr.addEventListener('click', () => {
        openEvidence(vessel.id);
      });

      tbody.appendChild(tr);
    });
  }

  // Open Evidence Dossier Modal
  function openEvidence(vesselId) {
    const vessel = window.OilTraceData.candidateVessels.find(v => v.id === vesselId);
    if (!vessel) return;

    activeVesselId = vesselId;
    const modalBackdrop = document.getElementById('evidence-modal-backdrop');
    if (!modalBackdrop) return;

    // Fill Modal Content
    document.getElementById('modal-vessel-title').textContent = `${vessel.name} [Candidate #${vessel.rank}]`;
    document.getElementById('modal-vessel-sub').textContent = `${vessel.type} • Flag: ${vessel.flag} (${vessel.flag_code}) • IMO: ${vessel.imo} • MMSI: ${vessel.mmsi}`;
    
    // Score Badge
    const scoreElem = document.getElementById('modal-correlation-score');
    scoreElem.textContent = `${vessel.correlation_score}% Match`;
    scoreElem.className = `score-text ${vessel.correlation_score >= 80 ? 'high' : 'elevated'}`;

    // Fill Quick Metrics
    document.getElementById('modal-metric-cpa').textContent = `${vessel.evidence_breakdown.cpa_distance_nm} nm`;
    document.getElementById('modal-metric-time').textContent = vessel.time_proximity_text;
    document.getElementById('modal-metric-route').textContent = `${vessel.route_similarity_pct}% Align`;
    document.getElementById('modal-metric-speed').textContent = `${vessel.speed_kts_at_slick} kts`;
    document.getElementById('modal-metric-heading').textContent = `${vessel.heading_deg_at_slick}°`;
    document.getElementById('modal-metric-cargo').textContent = vessel.evidence_breakdown.cargo_status;

    // Fill 5 Correlation Parameter Bars
    const eb = vessel.evidence_breakdown;
    setFactorBar('bar-distance', eb.distance_score, `${vessel.distance_nm} nm closest approach to slick perimeter`);
    setFactorBar('bar-time', eb.time_score, `${vessel.time_proximity_text} relative to estimated release`);
    setFactorBar('bar-trajectory', eb.trajectory_score, `${vessel.route_similarity_pct}% colinear with slick dispersion axis`);
    setFactorBar('bar-speed', eb.speed_score, vessel.speed_anomaly);
    setFactorBar('bar-heading', eb.heading_score, `Heading ${vessel.heading_deg_at_slick}° aligned within ${vessel.heading_alignment_deg}° of slick axis`);

    // Forensics Notes
    document.getElementById('modal-wake-note').textContent = eb.wake_match;
    document.getElementById('modal-ais-continuity').textContent = eb.ais_continuity;
    document.getElementById('modal-anomaly-note').textContent = eb.historical_anomaly;

    // Set Map deep link
    const viewOnMapBtn = document.getElementById('modal-btn-view-map');
    if (viewOnMapBtn) {
      viewOnMapBtn.onclick = function() {
        closeModal();
        window.OilTraceApp.navigateTo('dashboard');
        window.OilTraceMap.highlightTrajectory(vessel.id);
      };
    }

    modalBackdrop.classList.add('open');
  }

  function setFactorBar(barId, score, desc) {
    const bar = document.getElementById(barId);
    const scoreVal = document.getElementById(barId + '-val');
    const descElem = document.getElementById(barId + '-desc');

    if (bar) bar.style.width = `${score}%`;
    if (scoreVal) scoreVal.textContent = `${score}%`;
    if (descElem) descElem.textContent = desc;
  }

  function closeModal() {
    const modalBackdrop = document.getElementById('evidence-modal-backdrop');
    if (modalBackdrop) {
      modalBackdrop.classList.remove('open');
    }
    activeVesselId = null;
  }

  return {
    init,
    openEvidence,
    closeModal,
    renderTable
  };
})();
