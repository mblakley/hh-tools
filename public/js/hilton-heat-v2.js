// Hilton Heat Player Assignment System - Frontend

let allTeams = [];
let allRegistrations = [];
let selectedRegistrations = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, setting up event listeners...');
    
    // Set up tab switching
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
    
    // Set up sync button
    const syncBtn = document.getElementById('syncTeamsBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', syncTeams);
    }
    
    // Set up refresh dashboard button
    const refreshBtn = document.getElementById('refreshDashboardBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDashboard);
    }
    
    // Set up team search and filter
    const teamSearch = document.getElementById('teamSearch');
    if (teamSearch) {
        teamSearch.addEventListener('keyup', filterTeams);
    }
    
    const divisionFilter = document.getElementById('divisionFilter');
    if (divisionFilter) {
        divisionFilter.addEventListener('change', filterTeams);
    }
    
    const refreshTeamsBtn = document.getElementById('refreshTeamsBtn');
    if (refreshTeamsBtn) {
        refreshTeamsBtn.addEventListener('click', loadTeams);
    }
    
    // Set up modal event listeners
    modalEventListeners();
    
    // Initial load
    loadDashboard();
    loadTeams();
    
    console.log('Event listeners set up complete');
});

// Tab switching
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all tab buttons
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Activate corresponding button
    event.target.classList.add('active');
    
    // Load tab data
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'teams':
            loadTeams();
            break;
        case 'registrations':
            loadRegistrations();
            break;
        case 'assignments':
            loadAssignmentTeams();
            break;
    }
}

// Load dashboard summary
async function loadDashboard() {
    // Update stats immediately with in-memory data
    document.getElementById('statTeams').textContent = allTeams.length || 0;
    document.getElementById('statRegistrations').textContent = allRegistrations.length || 0;
    document.getElementById('statAssignments').textContent = 0;
    document.getElementById('statUnassigned').textContent = allRegistrations.length || 0;
    
    // Set default dashboard content
    document.getElementById('statusSummary').innerHTML = '<div class="alert alert-info">No assignments yet</div>';
    document.getElementById('topTeams').innerHTML = '<div class="alert alert-info">No team assignments yet</div>';
}

// Sync teams from TeamSnap and save to database
async function syncTeams(event) {
    const btn = event?.target || document.getElementById('syncTeamsBtn');
    if (!btn) {
        console.error('syncTeams: Button not found');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = '🔄 Fetching from TeamSnap...';
    
    console.log('syncTeams: Starting...');
    
    try {
        // Get teams from TeamSnap API
        console.log('syncTeams: Fetching from /api/hilton-heat/teamsnap/teams/all');
        const response = await fetch('/api/hilton-heat/teamsnap/teams/all');
        const data = await response.json();
        
        console.log('syncTeams: Data received:', data.success, 'Teams count:', data.count);
        
        if (!data.success || !data.teams) {
            throw new Error(data.error || 'No teams found');
        }
        
        // Filter out organizational groups (not actual teams)
        const organizationalGroups = [
            'Hilton Heat Board',
            'Hilton Heat Staff',
            'Tournament Committee',
            'Hilton Heat Coaches 2025-26',
            'Hilton Heat Team Managers 2025-26'
        ];
        
        allTeams = data.teams.filter(team => {
            const teamName = team.name || '';
            return !organizationalGroups.includes(teamName);
        });
        
        console.log(`syncTeams: Got ${allTeams.length} teams (filtered from ${data.teams.length}), now saving to database...`);
        
        // Save to database in background
        btn.textContent = `💾 Saving ${allTeams.length} teams to database...`;
        let saved = 0;
        let failed = 0;
        
        for (let i = 0; i < allTeams.length; i++) {
            const team = allTeams[i];
            btn.textContent = `💾 Saving team ${i + 1}/${allTeams.length}...`;
            
            try {
                const saveResponse = await fetch('/api/hilton-heat/teamsnap/save-team', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        teamsnap_id: String(team.id),
                        team_name: team.name,
                        division_name: team.division_name,
                        division_id: String(team.division_id),
                        season_name: team.season_name || '',
                        league_name: team.league_name,
                        organization_id: String(team.organization_id)
                    })
                });
                
                if (saveResponse.ok) {
                    saved++;
                } else {
                    failed++;
                    console.warn(`Failed to save team ${team.name}`);
                }
            } catch (err) {
                failed++;
                console.error(`Error saving team ${team.name}:`, err);
            }
        }
        
        console.log(`syncTeams: Saved ${saved} teams, ${failed} failed`);
        showAlert(`✅ Synced ${saved} teams to database!${failed > 0 ? ` (${failed} failed)` : ''}`, 'success');
        
        // Reload from database
        btn.textContent = '🔄 Refreshing...';
        await loadTeamsFromDB();
        loadDashboard();
        
    } catch (error) {
        console.error('syncTeams: Exception:', error);
        showAlert(`❌ Failed to sync teams: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Sync Teams from TeamSnap';
        console.log('syncTeams: Complete');
    }
}

// Load teams from database
async function loadTeamsFromDB() {
    const teamsList = document.getElementById('teamsList');
    
    console.log('loadTeamsFromDB: Fetching from database...');
    teamsList.innerHTML = '<div class="loading">Loading teams from database...</div>';
    
    try {
        const response = await fetch('/api/hilton-heat/assignments/teams');
        const data = await response.json();
        
        console.log('loadTeamsFromDB: Response:', data.success, 'Count:', data.count);
        
        if (data.success && data.teams) {
            // Filter out organizational groups (not actual teams)
            const organizationalGroups = [
                'Hilton Heat Board',
                'Hilton Heat Staff',
                'Tournament Committee',
                'Hilton Heat Coaches 2025-26',
                'Hilton Heat Team Managers 2025-26'
            ];
            
            allTeams = data.teams.filter(team => {
                const teamName = team.name || team.team_name || '';
                return !organizationalGroups.includes(teamName);
            });
            
            console.log(`loadTeamsFromDB: Loaded ${allTeams.length} teams from database (filtered from ${data.teams.length})`);
            
            // Update stat
            document.getElementById('statTeams').textContent = allTeams.length;
            
            // Populate division filter
            const divisions = [...new Set(allTeams.map(t => t.division_name).filter(d => d))];
            const divisionFilter = document.getElementById('divisionFilter');
            divisionFilter.innerHTML = '<option value="">All Divisions</option>' + 
                divisions.map(d => `<option value="${d}">${d}</option>`).join('');
            
            // Render teams
            renderTeams(allTeams);
        } else {
            console.log('loadTeamsFromDB: No teams found');
            renderTeams([]);
        }
    } catch (error) {
        console.error('loadTeamsFromDB: Error:', error);
        teamsList.innerHTML = '<div class="alert alert-error">Failed to load teams from database</div>';
    }
}

// Load teams list (from memory or database)
async function loadTeams() {
    const teamsList = document.getElementById('teamsList');
    
    console.log('loadTeams: Starting, allTeams.length =', allTeams.length);
    
    // If we have teams in memory, use them
    if (allTeams && allTeams.length > 0) {
        console.log('loadTeams: Using in-memory teams');
        
        // Update stat
        document.getElementById('statTeams').textContent = allTeams.length;
        
        // Populate division filter
        const divisions = [...new Set(allTeams.map(t => t.division_name).filter(d => d))];
        const divisionFilter = document.getElementById('divisionFilter');
        divisionFilter.innerHTML = '<option value="">All Divisions</option>' + 
            divisions.map(d => `<option value="${d}">${d}</option>`).join('');
        
        // Render teams
        renderTeams(allTeams);
    } else {
        // Try loading from database
        console.log('loadTeams: No teams in memory, trying database...');
        await loadTeamsFromDB();
    }
}

// Render teams grid
function renderTeams(teams) {
    const teamsList = document.getElementById('teamsList');
    
    if (teams.length === 0) {
        teamsList.innerHTML = `
            <div class="empty-state">
                <p>No teams loaded yet</p>
                <p>Switch to the Dashboard tab and click "Load Teams from TeamSnap"</p>
            </div>
        `;
        return;
    }
    
    teamsList.innerHTML = `
        <div class="grid">
            ${teams.map(team => {
                // Extract age group from team name (e.g., "GU09" from "GU09 - Vargas")
                const ageGroupMatch = (team.name || team.team_name).match(/^([BG]U\d+)/);
                const ageGroup = ageGroupMatch ? ageGroupMatch[1] : '';
                
                return `
                <div class="card" style="cursor: pointer;" data-team-id="${team.teamsnap_id || team.id}">
                    <h3>⚽ ${team.name || team.team_name}</h3>
                    ${ageGroup ? `<div class="detail">👥 Age Group: ${ageGroup}</div>` : ''}
                    <div class="detail">📅 Season: ${team.division_name || 'N/A'}</div>
                    <div class="detail">🏆 League: ${team.league_name || 'N/A'}</div>
                    <div class="detail">🔢 TeamSnap ID: ${team.teamsnap_id || team.id || 'N/A'}</div>
                    <div class="detail" style="margin-top: 10px;">
                        <small>Last synced: ${team.last_synced_at ? new Date(team.last_synced_at + ' UTC').toLocaleString() + ' (local time)' : 'Live from TeamSnap'}</small>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Add click handlers to team cards
    document.querySelectorAll('.card[data-team-id]').forEach(card => {
        card.addEventListener('click', () => {
            const teamId = card.dataset.teamId;
            const team = teams.find(t => (t.teamsnap_id || t.id) == teamId);
            if (team) {
                openTeamModal(team);
            }
        });
    });
}

// Filter teams
function filterTeams() {
    const searchTerm = document.getElementById('teamSearch').value.toLowerCase();
    const division = document.getElementById('divisionFilter').value;
    
    const filtered = allTeams.filter(team => {
        const teamName = team.name || team.team_name || '';
        const divisionName = team.division_name || '';
        
        const matchesSearch = !searchTerm || 
            teamName.toLowerCase().includes(searchTerm) ||
            divisionName.toLowerCase().includes(searchTerm);
        const matchesDivision = !division || divisionName === division;
        return matchesSearch && matchesDivision;
    });
    
    renderTeams(filtered);
}

// Load registrations
async function loadRegistrations() {
    const regList = document.getElementById('registrationsList');
    regList.innerHTML = '<div class="loading">Loading registrations...</div>';
    
    try {
        const response = await fetch('/api/hilton-heat/registrations');
        const data = await response.json();
        
        if (data.success) {
            allRegistrations = data.data || [];
            
            // Populate age group filter
            const ageGroups = [...new Set(allRegistrations.map(r => r.age_group).filter(a => a))];
            const ageFilter = document.getElementById('ageGroupFilter');
            ageFilter.innerHTML = '<option value="">All Age Groups</option>' + 
                ageGroups.map(a => `<option value="${a}">${a}</option>`).join('');
            
            renderRegistrations(allRegistrations);
        } else {
            regList.innerHTML = `<div class="alert alert-error">${data.error}</div>`;
        }
    } catch (error) {
        console.error('Error loading registrations:', error);
        regList.innerHTML = '<div class="alert alert-error">Failed to load registrations</div>';
    }
}

// Render registrations table
function renderRegistrations(registrations) {
    const regList = document.getElementById('registrationsList');
    
    if (registrations.length === 0) {
        regList.innerHTML = `
            <div class="empty-state">
                <p>No registrations found</p>
                <p><small>Import registrations from TeamSnap CSV export</small></p>
            </div>
        `;
        return;
    }
    
    regList.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th><input type="checkbox" class="checkbox" onclick="toggleSelectAll(this)"></th>
                    <th>Name</th>
                    <th>Age Group</th>
                    <th>Email</th>
                    <th>Parent</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${registrations.map(reg => `
                    <tr>
                        <td><input type="checkbox" class="checkbox" value="${reg.id}" onchange="toggleRegistration(this)"></td>
                        <td><strong>${reg.first_name} ${reg.last_name}</strong></td>
                        <td>${reg.age_group || '-'}</td>
                        <td>${reg.email || '-'}</td>
                        <td>${reg.parent_name || '-'}</td>
                        <td><span class="badge badge-${reg.status || 'pending'}">${reg.status || 'pending'}</span></td>
                        <td>
                            <button class="btn btn-secondary" onclick="quickAssign(${reg.id})">Assign</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // Show bulk actions if any selected
    updateBulkActions();
}

// Filter registrations
function filterRegistrations() {
    const searchTerm = document.getElementById('regSearch').value.toLowerCase();
    const ageGroup = document.getElementById('ageGroupFilter').value;
    const status = document.getElementById('statusFilter').value;
    
    const filtered = allRegistrations.filter(reg => {
        const matchesSearch = !searchTerm || 
            `${reg.first_name} ${reg.last_name}`.toLowerCase().includes(searchTerm) ||
            (reg.email && reg.email.toLowerCase().includes(searchTerm));
        const matchesAge = !ageGroup || reg.age_group === ageGroup;
        const matchesStatus = !status || reg.status === status;
        return matchesSearch && matchesAge && matchesStatus;
    });
    
    renderRegistrations(filtered);
}

// Toggle select all registrations
function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        toggleRegistration(cb);
    });
}

// Toggle individual registration selection
function toggleRegistration(checkbox) {
    const regId = parseInt(checkbox.value);
    
    if (checkbox.checked) {
        if (!selectedRegistrations.includes(regId)) {
            selectedRegistrations.push(regId);
        }
    } else {
        selectedRegistrations = selectedRegistrations.filter(id => id !== regId);
    }
    
    updateBulkActions();
}

// Update bulk actions visibility
function updateBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    if (selectedRegistrations.length > 0) {
        bulkActions.style.display = 'block';
    } else {
        bulkActions.style.display = 'none';
    }
}

// Quick assign single player
async function quickAssign(registrationId) {
    const teamId = prompt('Enter Team ID to assign to:');
    if (!teamId) return;
    
    try {
        const response = await fetch('/api/hilton-heat/assignments/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                registrationId: registrationId,
                teamId: parseInt(teamId),
                assignedBy: 'web-ui'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`✅ ${data.message}`, 'success');
            loadDashboard();
        } else {
            showAlert(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error assigning player:', error);
        showAlert('❌ Failed to assign player', 'error');
    }
}

// Bulk assign selected players
async function bulkAssign() {
    const teamId = document.getElementById('bulkTeamSelect').value;
    
    if (!teamId) {
        showAlert('❌ Please select a team', 'error');
        return;
    }
    
    if (selectedRegistrations.length === 0) {
        showAlert('❌ No registrations selected', 'error');
        return;
    }
    
    if (!confirm(`Assign ${selectedRegistrations.length} player(s) to selected team?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/hilton-heat/assignments/assign-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                registrationIds: selectedRegistrations,
                teamId: parseInt(teamId),
                assignedBy: 'web-ui'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`✅ Assigned ${data.assigned} players successfully!`, 'success');
            selectedRegistrations = [];
            loadRegistrations();
            loadDashboard();
        } else {
            showAlert(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error bulk assigning:', error);
        showAlert('❌ Failed to assign players', 'error');
    }
}

// Load assignment teams dropdown
function loadAssignmentTeams() {
    // Already loaded in loadTeams()
}

// Load assignments by team
async function loadAssignmentsByTeam() {
    const teamId = document.getElementById('assignmentTeamFilter').value;
    const assignmentsList = document.getElementById('assignmentsList');
    
    if (!teamId) {
        assignmentsList.innerHTML = '<div class="empty-state"><p>Select a team to view assignments</p></div>';
        return;
    }
    
    assignmentsList.innerHTML = '<div class="loading">Loading assignments...</div>';
    
    try {
        const response = await fetch(`/api/hilton-heat/assignments/team/${teamId}`);
        const data = await response.json();
        
        if (data.success) {
            if (data.count === 0) {
                assignmentsList.innerHTML = '<div class="alert alert-info">No players assigned to this team yet</div>';
                return;
            }
            
            assignmentsList.innerHTML = `
                <div class="section">
                    <h3>Summary</h3>
                    <div class="grid">
                        ${Object.entries(data.summary).filter(([key]) => key !== 'total').map(([status, count]) => `
                            <div class="card">
                                <h4><span class="badge badge-${status}">${status}</span></h4>
                                <div class="number">${count}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="section">
                    <h3>Players (${data.count})</h3>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Player Name</th>
                                <th>Age Group</th>
                                <th>Email</th>
                                <th>Parent</th>
                                <th>Status</th>
                                <th>Assigned</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.assignments.map(a => `
                                <tr>
                                    <td><strong>${a.first_name} ${a.last_name}</strong></td>
                                    <td>${a.age_group || '-'}</td>
                                    <td>${a.email || '-'}</td>
                                    <td>${a.parent_name || '-'}</td>
                                    <td><span class="badge badge-${a.assignment_status}">${a.assignment_status}</span></td>
                                    <td>${new Date(a.assigned_at).toLocaleDateString()}</td>
                                    <td>
                                        <select onchange="updateAssignmentStatus(${a.id}, this.value)">
                                            <option value="">Change status...</option>
                                            <option value="pending">Pending</option>
                                            <option value="invited">Invited</option>
                                            <option value="accepted">Accepted</option>
                                            <option value="declined">Declined</option>
                                            <option value="registered">Registered</option>
                                        </select>
                                        <button class="btn btn-danger" onclick="removeAssignment(${a.id})">Remove</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            assignmentsList.innerHTML = `<div class="alert alert-error">${data.error}</div>`;
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
        assignmentsList.innerHTML = '<div class="alert alert-error">Failed to load assignments</div>';
    }
}

// View team assignments (from dashboard or teams tab)
function viewTeamAssignments(teamId) {
    switchTab('assignments');
    document.getElementById('assignmentTeamFilter').value = teamId;
    loadAssignmentsByTeam();
}

// Update assignment status
async function updateAssignmentStatus(assignmentId, status) {
    if (!status) return;
    
    try {
        const response = await fetch(`/api/hilton-heat/assignments/${assignmentId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`✅ ${data.message}`, 'success');
            loadAssignmentsByTeam();
            loadDashboard();
        } else {
            showAlert(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showAlert('❌ Failed to update status', 'error');
    }
}

// Remove assignment
async function removeAssignment(assignmentId) {
    if (!confirm('Remove this assignment?')) return;
    
    try {
        const response = await fetch(`/api/hilton-heat/assignments/${assignmentId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`✅ ${data.message}`, 'success');
            loadAssignmentsByTeam();
            loadDashboard();
        } else {
            showAlert(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error removing assignment:', error);
        showAlert('❌ Failed to remove assignment', 'error');
    }
}

// Show alert message
function showAlert(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '9999';
    alert.style.minWidth = '300px';
    alert.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// ===================================
// TEAM MODAL FUNCTIONS
// ===================================

// Open team details modal
async function openTeamModal(team) {
    const modal = document.getElementById('teamModal');
    const modalBody = document.getElementById('modalBody');
    const modalTeamName = document.getElementById('modalTeamName');
    
    // Show modal with loading state
    modal.style.display = 'block';
    modalTeamName.textContent = `⚽ ${team.name || team.team_name}`;
    modalBody.innerHTML = '<div class="loading-modal">Loading team details</div>';
    
    try {
        // Fetch team members from TeamSnap API
        const teamId = team.teamsnap_id || team.id;
        const response = await fetch(`/api/hilton-heat/teamsnap/team/${teamId}/members`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load team members');
        }
        
        // Separate members by role
        const players = data.members.filter(m => m.is_non_player === false);
        const staff = data.members.filter(m => m.is_non_player === true);
        
        // Extract age group
        const ageGroupMatch = (team.name || team.team_name).match(/^([BG]U\d+)/);
        const ageGroup = ageGroupMatch ? ageGroupMatch[1] : 'N/A';
        
        // Render modal content
        modalBody.innerHTML = `
            <div class="modal-section">
                <h3>📋 Team Information</h3>
                <div class="team-info-grid">
                    <div class="info-item">
                        <label>Team Name</label>
                        <value>${team.name || team.team_name}</value>
                    </div>
                    <div class="info-item">
                        <label>Age Group</label>
                        <value>${ageGroup}</value>
                    </div>
                    <div class="info-item">
                        <label>Season</label>
                        <value>${team.division_name || team.season_name || 'N/A'}</value>
                    </div>
                    <div class="info-item">
                        <label>League</label>
                        <value>${team.league_name || 'N/A'}</value>
                    </div>
                    <div class="info-item">
                        <label>TeamSnap ID</label>
                        <value>${team.teamsnap_id || team.id || 'N/A'}</value>
                    </div>
                    <div class="info-item">
                        <label>Total Members</label>
                        <value>${data.members.length} (${players.length} players, ${staff.length} staff)</value>
                    </div>
                </div>
            </div>
            
            ${staff.length > 0 ? `
                <div class="modal-section">
                    <h3>👨‍🏫 Coaches & Staff (${staff.length})</h3>
                    <div class="members-list">
                        ${staff.map(member => renderMemberCard(member, 'staff')).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${players.length > 0 ? `
                <div class="modal-section">
                    <h3>⚽ Players (${players.length})</h3>
                    <div class="members-list">
                        ${players.map(member => renderMemberCard(member, 'player')).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${data.members.length === 0 ? `
                <div class="empty-state">
                    <p>No members found for this team</p>
                </div>
            ` : ''}
        `;
        
    } catch (error) {
        console.error('Error loading team details:', error);
        modalBody.innerHTML = `
            <div class="alert alert-error">
                <strong>Error loading team details</strong><br>
                ${error.message}
            </div>
        `;
    }
}

// Render individual member card
function renderMemberCard(member, type) {
    const isPlayer = type === 'player';
    const roleClass = member.is_manager ? 'manager' : (member.is_non_player ? 'coach' : 'player');
    const roleLabel = member.is_manager ? 'Manager' : (member.is_non_player ? 'Coach' : 'Player');
    
    // Get initials for avatar
    const firstName = member.first_name || '';
    const lastName = member.last_name || '';
    const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || '?';
    
    // Format birthday
    const birthday = member.birthday ? new Date(member.birthday).toLocaleDateString() : 'N/A';
    const age = member.birthday ? calculateAge(member.birthday) : null;
    
    return `
        <div class="member-card ${roleClass}">
            <div class="member-avatar">${initials}</div>
            <div class="member-info">
                <div class="member-name">${firstName} ${lastName}</div>
                <div class="member-details">
                    ${member.jersey_number ? `<span>👕 #${member.jersey_number}</span>` : ''}
                    ${member.position ? `<span>📍 ${member.position}</span>` : ''}
                    ${member.birthday ? `<span>🎂 ${birthday}${age ? ` (${age}y)` : ''}</span>` : ''}
                    ${member.email_address ? `<span>📧 ${member.email_address}</span>` : ''}
                    ${member.phone_number ? `<span>📱 ${member.phone_number}</span>` : ''}
                </div>
            </div>
            <div class="member-role ${roleClass}">${roleLabel}</div>
        </div>
    `;
}

// Calculate age from birthday
function calculateAge(birthday) {
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// Close modal
function closeTeamModal() {
    const modal = document.getElementById('teamModal');
    modal.style.display = 'none';
}

// Set up modal event listeners (will be called in existing DOMContentLoaded)
const modalEventListeners = () => {
    const modal = document.getElementById('teamModal');
    const closeBtn = document.getElementById('closeModal');
    
    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTeamModal);
    }
    
    // Click outside modal to close
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeTeamModal();
        }
    });
    
    // ESC key to close
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeTeamModal();
        }
    });
};

