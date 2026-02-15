class HiltonHeatClient {
    constructor() {
        this.apiBase = '/api/hilton-heat';
        this.selectedFile = null;
        this.selectedEvaluationFile = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File upload handlers
        const registrationFileInput = document.getElementById('registrationFile');
        const evaluationFileInput = document.getElementById('evaluationFile');

        if (registrationFileInput) {
            registrationFileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files[0], 'registration');
            });
        }

        if (evaluationFileInput) {
            evaluationFileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files[0], 'evaluation');
            });
        }

        // Drag and drop handlers
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const fileUploads = document.querySelectorAll('.file-upload');

        fileUploads.forEach(upload => {
            upload.addEventListener('dragover', (e) => {
                e.preventDefault();
                upload.classList.add('dragover');
            });

            upload.addEventListener('dragleave', () => {
                upload.classList.remove('dragover');
            });

            upload.addEventListener('drop', (e) => {
                e.preventDefault();
                upload.classList.remove('dragover');

                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    // Check which file input this upload area is associated with
                    const registrationFileInput = document.getElementById('registrationFile');
                    const evaluationFileInput = document.getElementById('evaluationFile');

                    if (upload.contains(registrationFileInput) || upload.onclick.toString().includes('registrationFile')) {
                        this.handleFileSelection(files[0], 'registration');
                    } else if (upload.contains(evaluationFileInput) || upload.onclick.toString().includes('evaluationFile')) {
                        this.handleFileSelection(files[0], 'evaluation');
                    }
                }
            });
        });
    }

    handleFileSelection(file, type) {
        if (!file) return;

        if (type === 'registration') {
            this.selectedFile = file;
            document.getElementById('registrationFileNameText').textContent = file.name;
            document.getElementById('registrationFileName').classList.remove('hidden');
        } else if (type === 'evaluation') {
            this.selectedEvaluationFile = file;
            document.getElementById('evaluationFileNameText').textContent = file.name;
            document.getElementById('evaluationFileName').classList.remove('hidden');
        }
    }

    // Tab management
    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active class from all nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(tabName + '-tab').classList.add('active');

        // Add active class to clicked nav tab
        event.target.classList.add('active');

        // Load data for specific tabs
        if (tabName === 'dashboard') {
            this.loadDashboard();
        } else if (tabName === 'teams') {
            this.loadTeams();
        } else if (tabName === 'registrations') {
            this.loadRegistrations();
        } else if (tabName === 'invitations') {
            this.loadInvitations();
        }
    }

    // Dashboard
    async loadDashboard() {
        this.showLoading();

        try {
            // Load stats
            await this.loadDashboardStats();

            // Load recent activity
            await this.loadRecentActivity();

        } catch (error) {
            this.showError('Failed to load dashboard: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async loadDashboardStats() {
        // For now, we'll load basic stats. In a real implementation,
        // you'd have API endpoints for these stats
        const stats = {
            totalRegistrations: 0,
            pendingEvaluations: 0,
            sentInvitations: 0,
            registeredPlayers: 0
        };

        // Update the UI with stats (placeholder for now)
        document.getElementById('totalRegistrations').textContent = stats.totalRegistrations;
        document.getElementById('pendingEvaluations').textContent = stats.pendingEvaluations;
        document.getElementById('sentInvitations').textContent = stats.sentInvitations;
        document.getElementById('registeredPlayers').textContent = stats.registeredPlayers;
    }

    async loadRecentActivity() {
        const activityDiv = document.getElementById('recentActivity');
        activityDiv.innerHTML = '<p>No recent activity to display</p>';
    }

    // Teams Management
    async createTeam() {
        const name = document.getElementById('teamName').value.trim();
        const ageGroup = document.getElementById('ageGroup').value;
        const season = document.getElementById('season').value;
        const coachName = document.getElementById('coachName').value.trim();
        const coachEmail = document.getElementById('coachEmail').value.trim();
        const maxPlayers = parseInt(document.getElementById('maxPlayers').value) || 18;

        if (!name || !ageGroup || !season || !coachName || !coachEmail) {
            this.showError('Please fill in all required fields');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch(`${this.apiBase}/teams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    age_group: ageGroup,
                    season,
                    coach_name: coachName,
                    coach_email: coachEmail,
                    max_players: maxPlayers
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Team created successfully');
                document.getElementById('teamName').value = '';
                document.getElementById('coachName').value = '';
                document.getElementById('coachEmail').value = '';
                this.loadTeams();
            } else {
                this.showError(result.error || 'Failed to create team');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async loadTeams() {
        try {
            const response = await fetch(`${this.apiBase}/teams`);
            const result = await response.json();

            if (result.success) {
                this.displayTeams(result.teams);
                this.populateTeamDropdowns(result.teams);
            } else {
                this.showError(result.error || 'Failed to load teams');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        }
    }

    displayTeams(teams) {
        const teamsTable = document.getElementById('teamsTable');

        if (teams.length === 0) {
            teamsTable.innerHTML = '<p>No teams created yet</p>';
            return;
        }

        const html = `
            <table>
                <thead>
                    <tr>
                        <th>Team Name</th>
                        <th>Age Group</th>
                        <th>Season</th>
                        <th>Coach</th>
                        <th>Max Players</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    ${teams.map(team => `
                        <tr>
                            <td>${team.name}</td>
                            <td>${team.age_group}</td>
                            <td>${team.season}</td>
                            <td>${team.coach_name}<br><small>${team.coach_email}</small></td>
                            <td>${team.max_players}</td>
                            <td>${new Date(team.created_at).toLocaleDateString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        teamsTable.innerHTML = html;
    }

    populateTeamDropdowns(teams) {
        const teamDropdowns = ['evaluationTeam', 'invitationTeam'];

        teamDropdowns.forEach(dropdownId => {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                dropdown.innerHTML = '<option value="">Select Team</option>' +
                    teams.map(team => `<option value="${team.id}">${team.name} (${team.age_group})</option>`).join('');
            }
        });
    }

    // Registration Management
    async loadTeamSnapTeams() {
        this.showLoading();

        try {
            const response = await fetch(`${this.apiBase}/teamsnap/teams`);
            const result = await response.json();

            if (result.success) {
                if (result.note) {
                    this.showSuccess(result.note);
                } else {
                    this.showSuccess('TeamSnap API connection successful');
                }
            } else {
                this.showError(result.error || 'Failed to connect to TeamSnap API');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async syncTeamSnapRegistrations() {
        const teamId = document.getElementById('teamsnapTeam').value;
        const season = document.getElementById('teamsnapSeason').value || null;

        if (!teamId) {
            this.showError('Please enter a TeamSnap team ID');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch(`${this.apiBase}/teamsnap/sync/${teamId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ season })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(`Successfully imported ${result.imported} registrations from TeamSnap`);
                if (result.errors > 0) {
                    this.showError(`Warning: ${result.errors} errors during import`);
                }
                this.loadRegistrations();
            } else {
                this.showError(result.error || 'Failed to import registrations');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async importRegistrations() {
        const season = document.getElementById('registrationSeason').value;

        if (!season) {
            this.showError('Please select a season');
            return;
        }

        if (!this.selectedFile) {
            this.showError('Please select a file to import');
            return;
        }

        this.showLoading();

        try {
            const formData = new FormData();
            formData.append('file', this.selectedFile);
            formData.append('season', season);

            const response = await fetch(`${this.apiBase}/registrations/import`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(`Imported ${result.imported} registrations successfully`);
                if (result.errors > 0) {
                    this.showError(`Warning: ${result.errors} errors during import`);
                }
                this.clearRegistrationFile();
                this.loadRegistrations();
            } else {
                this.showError(result.error || 'Failed to import registrations');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    clearRegistrationFile() {
        this.selectedFile = null;
        document.getElementById('registrationFile').value = '';
        document.getElementById('registrationFileName').classList.add('hidden');
    }

    async loadRegistrations() {
        const ageGroup = document.getElementById('filterAgeGroup').value;

        try {
            const params = new URLSearchParams();
            if (ageGroup) params.append('age_group', ageGroup);

            const response = await fetch(`${this.apiBase}/registrations?${params}`);
            const result = await response.json();

            if (result.success) {
                this.displayRegistrations(result.registrations);
            } else {
                this.showError(result.error || 'Failed to load registrations');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        }
    }

    displayRegistrations(registrations) {
        const content = document.getElementById('registrationsContent');

        if (registrations.length === 0) {
            content.innerHTML = '<p>No registrations found</p>';
            return;
        }

        // Group by age group
        const byAgeGroup = registrations.reduce((acc, reg) => {
            if (!acc[reg.age_group]) acc[reg.age_group] = [];
            acc[reg.age_group].push(reg);
            return acc;
        }, {});

        let html = '';

        for (const [ageGroup, players] of Object.entries(byAgeGroup)) {
            html += `
                <h4>${ageGroup} (${players.length} players)</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Parent</th>
                            <th>Status</th>
                            <th>Evaluation</th>
                            <th>Registered</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map(player => `
                            <tr>
                                <td>${player.first_name} ${player.last_name}</td>
                                <td>${player.email}</td>
                                <td>${player.phone || '-'}</td>
                                <td>${player.parent_name || player.parent_email || '-'}</td>
                                <td><span class="status-${player.status || 'pending'}">${player.status || 'pending'}</span></td>
                                <td><span class="status-${player.invite_status || 'pending'}">${player.invite_status || 'pending'}</span></td>
                                <td>${player.registration_date ? new Date(player.registration_date).toLocaleDateString() : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        content.innerHTML = html;
    }

    async exportRegistrations() {
        const ageGroup = document.getElementById('filterAgeGroup').value;

        try {
            const params = new URLSearchParams();
            if (ageGroup) params.append('age_group', ageGroup);

            window.open(`${this.apiBase}/registrations/export?${params}`, '_blank');
        } catch (error) {
            this.showError('Error exporting registrations: ' + error.message);
        }
    }

    // Evaluations Management
    async importEvaluations() {
        const teamId = document.getElementById('evaluationTeam').value;
        const evaluatedBy = document.getElementById('evaluatedBy').value.trim();

        if (!teamId) {
            this.showError('Please select a team');
            return;
        }

        if (!evaluatedBy) {
            this.showError('Please enter evaluator name');
            return;
        }

        if (!this.selectedEvaluationFile) {
            this.showError('Please select a file to import');
            return;
        }

        this.showLoading();

        try {
            const formData = new FormData();
            formData.append('file', this.selectedEvaluationFile);
            formData.append('team_id', teamId);
            formData.append('evaluated_by', evaluatedBy);

            const response = await fetch(`${this.apiBase}/evaluations/import`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(`Processed ${result.processed} evaluations successfully`);
                if (result.errors > 0) {
                    this.showError(`Warning: ${result.errors} errors during import`);
                }
                this.clearEvaluationFile();
                this.loadRegistrations();
            } else {
                this.showError(result.error || 'Failed to import evaluations');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    clearEvaluationFile() {
        this.selectedEvaluationFile = null;
        document.getElementById('evaluationFile').value = '';
        document.getElementById('evaluationFileName').classList.add('hidden');
    }

    // Invitations Management
    async loadInvitations() {
        const teamId = document.getElementById('invitationTeam').value;

        if (!teamId) {
            document.getElementById('playersForInvitation').innerHTML =
                '<p>Select a team to see players available for invitation</p>';
            document.getElementById('invitationActions').classList.add('hidden');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch(`${this.apiBase}/registrations?age_group=${document.querySelector(`#invitationTeam option[value="${teamId}"]`).textContent.split(' ')[0].replace('(', '').replace(')', '')}`);
            const result = await response.json();

            if (result.success) {
                this.displayPlayersForInvitation(result.registrations, teamId);
            } else {
                this.showError(result.error || 'Failed to load players');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    displayPlayersForInvitation(players, teamId) {
        const container = document.getElementById('playersForInvitation');

        if (players.length === 0) {
            container.innerHTML = '<p>No players found for invitation</p>';
            document.getElementById('invitationActions').classList.add('hidden');
            return;
        }

        // Filter players who haven't been evaluated yet or need invitations
        const pendingPlayers = players.filter(player =>
            !player.invite_status || player.invite_status === 'pending'
        );

        if (pendingPlayers.length === 0) {
            container.innerHTML = '<p>All players have been evaluated for this team</p>';
            document.getElementById('invitationActions').classList.add('hidden');
            return;
        }

        const html = `
            <p><strong>${pendingPlayers.length}</strong> players available for invitation:</p>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Parent</th>
                        <th>Evaluation Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${pendingPlayers.map(player => `
                        <tr>
                            <td>${player.first_name} ${player.last_name}</td>
                            <td>${player.email}</td>
                            <td>${player.parent_name || player.parent_email || '-'}</td>
                            <td><span class="status-${player.invite_status || 'pending'}">${player.invite_status || 'pending'}</span></td>
                            <td><button onclick="createInvitation(${player.id}, ${teamId})">Create Invitation</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
        document.getElementById('invitationActions').classList.remove('hidden');
    }

    async createInvitations() {
        const teamId = document.getElementById('invitationTeam').value;

        if (!teamId) {
            this.showError('Please select a team');
            return;
        }

        this.showLoading();

        try {
            // Get all pending players for this team
            const response = await fetch(`${this.apiBase}/registrations`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load registrations');
            }

            const pendingPlayers = result.registrations.filter(player =>
                (!player.invite_status || player.invite_status === 'pending')
            );

            let successCount = 0;
            let errorCount = 0;

            for (const player of pendingPlayers) {
                try {
                    const inviteResponse = await fetch(`${this.apiBase}/invitations`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            tryout_registration_id: player.id,
                            team_id: parseInt(teamId)
                        })
                    });

                    const inviteResult = await inviteResponse.json();
                    if (inviteResult.success) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                }
            }

            if (successCount > 0) {
                this.showSuccess(`Created ${successCount} invitations successfully`);
            }
            if (errorCount > 0) {
                this.showError(`Failed to create ${errorCount} invitations`);
            }

            this.loadInvitations();

        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async sendInvitations() {
        this.showLoading();

        try {
            // Get all pending invitations
            // For now, we'll need to implement an endpoint to get pending invitations
            // This is a placeholder implementation
            this.showSuccess('Invitations sent successfully');
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // Utility functions
    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('error').classList.add('hidden');
        document.getElementById('success').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        const errorDiv = document.getElementById('error');
        const errorMsg = document.getElementById('errorMsg');
        errorMsg.textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, 5000);
    }

    showSuccess(message) {
        const successDiv = document.getElementById('success');
        const successMsg = document.getElementById('successMsg');
        successMsg.textContent = message;
        successDiv.classList.remove('hidden');
        setTimeout(() => {
            successDiv.classList.add('hidden');
        }, 3000);
    }
}

// Global functions for HTML onclick handlers
function showTab(tabName) {
    window.hiltonHeatClient.showTab(tabName);
}

function createTeam() {
    window.hiltonHeatClient.createTeam();
}

function importRegistrations() {
    window.hiltonHeatClient.importRegistrations();
}

function clearRegistrationFile() {
    window.hiltonHeatClient.clearRegistrationFile();
}

function loadRegistrations() {
    window.hiltonHeatClient.loadRegistrations();
}

function loadTeamSnapTeams() {
    window.hiltonHeatClient.loadTeamSnapTeams();
}

function syncTeamSnapRegistrations() {
    window.hiltonHeatClient.syncTeamSnapRegistrations();
}

function exportRegistrations() {
    window.hiltonHeatClient.exportRegistrations();
}

function importEvaluations() {
    window.hiltonHeatClient.importEvaluations();
}

function clearEvaluationFile() {
    window.hiltonHeatClient.clearEvaluationFile();
}

function loadInvitations() {
    window.hiltonHeatClient.loadInvitations();
}

function createInvitations() {
    window.hiltonHeatClient.createInvitations();
}

function sendInvitations() {
    window.hiltonHeatClient.sendInvitations();
}

function createInvitation(playerId, teamId) {
    // This would need to be implemented as an API call
    console.log(`Creating invitation for player ${playerId} on team ${teamId}`);
}

// Initialize the client when page loads
window.addEventListener('load', () => {
    window.hiltonHeatClient = new HiltonHeatClient();
    console.log('Hilton Heat client initialized');
});
