class RDYSLClient {
    constructor() {
        this.apiBase = '/api';
    }

    async getCallupData(playerSearch = '', forceRefresh = false) {
        try {
            const response = await fetch(`${this.apiBase}/callups`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '1'
                },
                body: JSON.stringify({ playerSearch, forceRefresh })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch callup data'
            };
        }
    }

    async getCachedData() {
        try {
            const response = await fetch(`${this.apiBase}/callups/cached`, {
                headers: {
                    'ngrok-skip-browser-warning': '1'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch cached data'
            };
        }
    }

    async checkHealth() {
        try {
            const response = await fetch(`${this.apiBase}/health`, {
                headers: {
                    'ngrok-skip-browser-warning': '1'
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'unhealthy' };
        }
    }
}

// Initialize client
const client = new RDYSLClient();

// Global DOM element references
let getDataBtn, forceRefreshCheckbox, playerSearch, loading, error, success, results, errorMsg, successMsg;

async function handleGetData() {
    console.log('Get Callup Data button clicked');
    const searchTerm = playerSearch.value.trim();
    const forceRefresh = forceRefreshCheckbox ? forceRefreshCheckbox.checked : false;
    console.log('Search term:', searchTerm, 'Force refresh:', forceRefresh);
    showLoading();

    try {
        console.log('Making API call to get callup data...');
        // Always get full data, client-side filtering will be done in showResults
        const result = await client.getCallupData('', forceRefresh);
        console.log('API response received:', result);

        if (result.success) {
            console.log('Success! Showing results with', result.summary.length, 'players');
            showResults(result, searchTerm);
            showSuccess('Data retrieved successfully');
        } else {
            console.log('API error:', result.error);
            showError(result.error || 'Failed to get callup data');
        }
    } catch (error) {
        console.log('Network error:', error);
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

async function handleRefreshData() {
    showLoading();

    try {
        // Force refresh by getting fresh data
        const result = await client.getCallupData(playerSearch.value.trim(), true);

        if (result.success) {
            showResults(result, playerSearch.value.trim());
            showSuccess('Data refreshed successfully');
        } else {
            showError(result.error || 'Failed to refresh data');
        }
    } catch (error) {
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

function showLoading() {
    // Hide error and success messages but keep results visible during loading
    error.classList.add('hidden');
    success.classList.add('hidden');

    loading.classList.remove('hidden');
    getDataBtn.disabled = true;
    getDataBtn.textContent = 'Loading...';
}

function hideLoading() {
    loading.classList.add('hidden');
    getDataBtn.disabled = false;
    getDataBtn.textContent = 'Get Callup Data';
}

function showError(message) {
    // Hide loading and success, but don't hide error since we're showing it
    loading.classList.add('hidden');
    success.classList.add('hidden');

    errorMsg.textContent = message;
    error.classList.remove('hidden');
}

function showSuccess(message) {
    successMsg.textContent = message;
    success.classList.remove('hidden');

    // Hide success message after 3 seconds
    setTimeout(() => {
        success.classList.add('hidden');
    }, 3000);
}

function showResults(data, playerSearch = '') {
    console.log('showResults called with data:', data);
    console.log('Data summary length:', data.summary ? data.summary.length : 'undefined');

    // Hide loading, error, and success, but don't hide results since we're showing them
    loading.classList.add('hidden');
    error.classList.add('hidden');
    success.classList.add('hidden');

    if (!data.summary) {
        console.log('No summary data found');
        return;
    }

    let searchMessage = '';

    // Generate search message if player search was provided
    if (playerSearch) {
        const searchTerm = playerSearch.toLowerCase();
        const foundPlayer = data.summary.find(player =>
            player.playerName.toLowerCase().includes(searchTerm)
        );

        if (foundPlayer) {
            searchMessage = `${foundPlayer.playerName} - ${foundPlayer.status} (${foundPlayer.callupCount} callups)`;
        } else {
            searchMessage = `No callups found for player "${playerSearch}".`;
        }

        // Show search message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'info';

        // Color the search result box based on player status
        if (foundPlayer && (foundPlayer.isOverLimit || foundPlayer.isUnavailable)) {
            messageDiv.style.background = '#ffe6e6';
            messageDiv.style.borderColor = '#ff9999';
        } else if (foundPlayer && foundPlayer.isWarning) {
            messageDiv.style.background = '#fff3cd';
            messageDiv.style.borderColor = '#ffeaa7';
        } else {
            messageDiv.style.background = '#f0f8ff';
            messageDiv.style.borderColor = '#b3d9ff';
        }

        messageDiv.innerHTML = `<strong>Search Result:</strong> ${searchMessage}`;
        results.insertBefore(messageDiv, results.firstChild);
    }

    // Update stats
    if (data.stats) {
        document.getElementById('totalPlayers').textContent = data.stats.totalPlayers;
        document.getElementById('warnings').textContent = data.stats.warnings;
        document.getElementById('unavailable').textContent = data.stats.unavailable;
        document.getElementById('overLimit').textContent = data.stats.overLimit;
        document.getElementById('totalCallups').textContent = data.stats.totalCallups;
    }

    // Update table
    console.log('Updating table with', data.summary.length, 'players');

    // Sort players: first by callupCount (descending), then by playerName (ascending)
    const sortedPlayers = [...data.summary].sort((a, b) => {
        // First sort by callupCount (descending)
        if (a.callupCount !== b.callupCount) {
            return b.callupCount - a.callupCount;
        }
        // Then by playerName (ascending) for same callup count
        return a.playerName.localeCompare(b.playerName);
    });

    const tableBody = document.getElementById('playerTable');
    const tableHtml = sortedPlayers.map(player => {
        let rowClass = '';
        let statusClass = 'status-ok';
        let statusText = 'OK';

        if (player.isOverLimit) {
            rowClass = 'over-limit';
            statusClass = 'status-over';
            statusText = 'OVER LIMIT';
        } else if (player.isUnavailable) {
            rowClass = 'over-limit';
            statusClass = 'status-over';
            statusText = 'UNAVAILABLE';
        } else if (player.isWarning) {
            rowClass = 'warning-row';
            statusClass = 'status-warning';
            statusText = 'WARNING';
        }

        return `
            <tr class="${rowClass}">
                <td>${player.playerName}</td>
                <td>${player.callupCount}</td>
                <td class="${statusClass}">
                    ${statusText}
                </td>
            </tr>
        `;
    }).join('');

    console.log('Generated table HTML, setting innerHTML...');
    tableBody.innerHTML = tableHtml;
    console.log('Table updated, showing results section');

    // Update last updated time
    if (data.lastUpdated) {
        const lastUpdatedDiv = document.getElementById('lastUpdated');
        const updateTime = new Date(data.lastUpdated).toLocaleString();
        lastUpdatedDiv.textContent = `Last updated: ${updateTime}`;
    }

    console.log('Making results section visible');
    results.classList.remove('hidden');
    console.log('Results displayed successfully');
}

function hideAll() {
    loading.classList.add('hidden');
    error.classList.add('hidden');
    success.classList.add('hidden');
    results.classList.add('hidden');
}

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('Page loaded, initializing...');

    // Assign DOM elements to global variables
    getDataBtn = document.getElementById('getDataBtn');
    forceRefreshCheckbox = document.getElementById('forceRefresh');
    playerSearch = document.getElementById('playerSearch');
    loading = document.getElementById('loading');
    error = document.getElementById('error');
    success = document.getElementById('success');
    results = document.getElementById('results');
    errorMsg = document.getElementById('errorMsg');
    successMsg = document.getElementById('successMsg');

    console.log('DOM elements found:', {
        getDataBtn: !!getDataBtn,
        forceRefreshCheckbox: !!forceRefreshCheckbox,
        playerSearch: !!playerSearch,
        loading: !!loading,
        error: !!error,
        success: !!success,
        results: !!results
    });

    // Event listeners
    if (getDataBtn) {
        getDataBtn.addEventListener('click', handleGetData);
        console.log('Get Data button event listener added');
    }

    // Force refresh functionality is now handled by checkbox

    if (playerSearch) {
        playerSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleGetData();
            }
        });
        console.log('Player search event listener added');
    }

    // Note: Not loading cached data automatically on page load
    // Data will be loaded when user clicks "Get Callup Data" button
    console.log('Page loaded successfully. Click "Get Callup Data" to load data.');
});
