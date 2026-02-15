// API Configuration
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

// DOM Elements
const getDataBtn = document.getElementById('getDataBtn');
const playerSearchInput = document.getElementById('playerSearch');
const forceRefreshCheckbox = document.getElementById('forceRefresh');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const errorMsg = document.getElementById('errorMsg');
const successDiv = document.getElementById('success');
const successMsg = document.getElementById('successMsg');
const resultsDiv = document.getElementById('results');

// Stats elements
const totalPlayersEl = document.getElementById('totalPlayers');
const warningsEl = document.getElementById('warnings');
const unavailableEl = document.getElementById('unavailable');
const overLimitEl = document.getElementById('overLimit');
const totalCallupsEl = document.getElementById('totalCallups');
const playerTableEl = document.getElementById('playerTable');
const lastUpdatedEl = document.getElementById('lastUpdated');

// Event Listeners
getDataBtn.addEventListener('click', loadCallupData);
playerSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadCallupData();
});

/**
 * Load callup data from API
 */
async function loadCallupData() {
    const forceRefresh = forceRefreshCheckbox.checked;
    const playerSearch = playerSearchInput.value.trim();

    showLoading();

    try {
        const url = forceRefresh
            ? `${API_BASE}/callups?forceRefresh=true`
            : `${API_BASE}/callups`;

        const response = await fetch(url, {
            method: forceRefresh ? 'POST' : 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            showResults(data, playerSearch);
        } else {
            showError(data.error || 'Failed to fetch callup data');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Network error. Please check your connection and try again.');
    } finally {
        hideLoading();
    }
}

/**
 * Show loading state
 */
function showLoading() {
    loadingDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    resultsDiv.classList.add('hidden');
    getDataBtn.disabled = true;
}

/**
 * Hide loading state
 */
function hideLoading() {
    loadingDiv.classList.add('hidden');
    getDataBtn.disabled = false;
}

/**
 * Show error message
 */
function showError(message) {
    errorMsg.textContent = message;
    errorDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');
    resultsDiv.classList.add('hidden');
}

/**
 * Show success message
 */
function showSuccess(message) {
    successMsg.textContent = message;
    successDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
}

/**
 * Show results
 */
function showResults(data, playerSearch) {
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    resultsDiv.classList.remove('hidden');

    // Show search result if applicable
    if (playerSearch) {
        const foundPlayer = data.summary.find(p =>
            p.playerName.toLowerCase().includes(playerSearch.toLowerCase())
        );

        if (foundPlayer) {
            showSuccess(`Found: ${foundPlayer.playerName} - ${foundPlayer.status} (${foundPlayer.callupCount} callups)`);
        } else {
            showSuccess(`No callups found for "${playerSearch}"`);
        }
    } else {
        showSuccess(`Loaded ${data.stats.totalPlayers} players with ${data.stats.totalCallups} total callups`);
    }

    // Update stats
    totalPlayersEl.textContent = data.stats.totalPlayers;
    warningsEl.textContent = data.stats.warnings;
    unavailableEl.textContent = data.stats.unavailable;
    overLimitEl.textContent = data.stats.overLimit;
    totalCallupsEl.textContent = data.stats.totalCallups;

    // Update table
    playerTableEl.innerHTML = data.summary.map(player => {
        let rowClass = '';
        let statusClass = 'status-ok';

        if (player.isOverLimit) {
            rowClass = 'over-limit';
            statusClass = 'status-over';
        } else if (player.isUnavailable) {
            rowClass = 'over-limit';
            statusClass = 'status-over';
        } else if (player.isWarning) {
            rowClass = 'warning-row';
            statusClass = 'status-warning';
        }

        return `
            <tr class="${rowClass}">
                <td>${player.playerName}</td>
                <td>${player.callupCount}</td>
                <td class="${statusClass}">${player.status}</td>
            </tr>
        `;
    }).join('');

    // Update last updated timestamp
    const lastUpdated = new Date(data.lastUpdated);
    const cached = data.cached ? ' (cached)' : ' (freshly scraped)';
    lastUpdatedEl.textContent = `Last updated: ${lastUpdated.toLocaleString()}${cached}`;
}
