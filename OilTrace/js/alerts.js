/**
 * OIL TRACE AI - ALERTS MANAGEMENT SYSTEM
 * Real-time operational maritime feed for:
 * 1. Potential Oil-Spill Detection Alerts
 * 2. Candidate Vessel Alerts
 * 3. AIS Data Issues (Blackouts, Jitter, Spoofing)
 */

window.OilTraceAlerts = (function() {
  let activeCategory = 'all';
  let activeSeverity = 'all';
  let searchQuery = '';

  function init() {
    setupAlertFilters();
    renderAlertsFeed();
  }

  function setupAlertFilters() {
    // Category Tabs
    const tabBtns = document.querySelectorAll('.alert-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.getAttribute('data-category');
        renderAlertsFeed();
      });
    });

    // Severity Selector
    const severitySelect = document.getElementById('alert-severity-filter');
    if (severitySelect) {
      severitySelect.addEventListener('change', (e) => {
        activeSeverity = e.target.value;
        renderAlertsFeed();
      });
    }

    // Search input
    const searchInput = document.getElementById('alert-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderAlertsFeed();
      });
    }
  }

  function getFilteredAlerts() {
    let list = [...window.OilTraceData.alerts];

    // Filter by Category
    if (activeCategory === 'spill') {
      list = list.filter(a => a.category.includes('Oil Spill'));
    } else if (activeCategory === 'vessel') {
      list = list.filter(a => a.category.includes('Candidate Vessel'));
    } else if (activeCategory === 'ais') {
      list = list.filter(a => a.category.includes('AIS'));
    }

    // Filter by Severity
    if (activeSeverity !== 'all') {
      list = list.filter(a => a.severity.toLowerCase() === activeSeverity.toLowerCase());
    }

    // Search Query
    if (searchQuery) {
      list = list.filter(a => 
        a.title.toLowerCase().includes(searchQuery) ||
        a.location.toLowerCase().includes(searchQuery) ||
        a.details.toLowerCase().includes(searchQuery) ||
        a.category.toLowerCase().includes(searchQuery)
      );
    }

    return list;
  }

  function renderAlertsFeed() {
    const container = document.getElementById('alerts-feed-container');
    if (!container) return;

    const alerts = getFilteredAlerts();
    container.innerHTML = '';

    if (alerts.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: var(--bg-deep); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-muted);">
          No operational maritime alerts match the selected criteria.
        </div>
      `;
      return;
    }

    alerts.forEach(alert => {
      const card = document.createElement('div');
      card.className = `alert-card severity-${alert.severity.toLowerCase()}`;

      let actionBtnHtml = '';
      if (alert.spillId) {
        actionBtnHtml = `
          <button class="btn-secondary" onclick="window.OilTraceApp.navigateTo('satellite-analysis');" style="padding: 6px 12px; font-size: 0.74rem;">
            Inspect Satellite Scan →
          </button>
        `;
      } else if (alert.vesselId) {
        actionBtnHtml = `
          <button class="btn-secondary" onclick="window.OilTraceApp.navigateTo('vessel-ranking'); window.OilTraceRanking.openEvidence('${alert.vesselId}');" style="padding: 6px 12px; font-size: 0.74rem;">
            Investigate Candidate →
          </button>
        `;
      } else {
        actionBtnHtml = `
          <button class="btn-secondary" onclick="window.OilTraceApp.navigateTo('dashboard');" style="padding: 6px 12px; font-size: 0.74rem;">
            View on Map →
          </button>
        `;
      }

      card.innerHTML = `
        <div class="alert-info-col">
          <div class="alert-headline-row">
            <span class="severity-badge severity-${alert.severity.toLowerCase()}">${alert.severity}</span>
            <span class="alert-title">${alert.title}</span>
          </div>
          <div class="alert-description">${alert.details}</div>
          <div class="alert-telemetry-meta">
            <span class="alert-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              ${alert.location}
            </span>
            <span class="alert-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              ${alert.zone}
            </span>
            <span class="alert-meta-item" style="color: var(--radar-cyan);">
              Category: ${alert.category}
            </span>
          </div>
        </div>
        <div class="alert-action-col">
          <span class="alert-timestamp">${alert.relativeTime} (${alert.timestamp.replace('T', ' ').replace('Z', ' UTC')})</span>
          ${actionBtnHtml}
        </div>
      `;

      container.appendChild(card);
    });

    // Update alert counter badge on sidebar
    const badge = document.getElementById('sidebar-alert-badge');
    if (badge) {
      const criticalCount = window.OilTraceData.alerts.filter(a => a.severity === 'CRITICAL').length;
      badge.textContent = criticalCount;
    }
  }

  return {
    init,
    renderAlertsFeed
  };
})();
