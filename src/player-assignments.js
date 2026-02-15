/**
 * Player Assignments Module
 * Manages assignment of tryout registrations to TeamSnap teams
 */

class PlayerAssignments {
  constructor(database, teamSnapAPI) {
    this.db = database;
    this.teamSnapAPI = teamSnapAPI;
  }

  /**
   * Sync TeamSnap teams to local database
   */
  async syncTeamSnapTeams() {
    try {
      console.log('Syncing TeamSnap teams to database...');

      // Fetch all teams from TeamSnap
      const result = await this.teamSnapAPI.getAllOrganizationTeams();

      if (!result.success || result.count === 0) {
        return {
          success: false,
          error: 'No teams found in TeamSnap'
        };
      }

      let syncedCount = 0;
      let updatedCount = 0;

      for (const team of result.teams) {
        // Check if team already exists
        const existing = await this.db.get(
          'SELECT id FROM teamsnap_teams WHERE teamsnap_id = ?',
          [team.id]
        );

        if (existing) {
          // Update existing team
          await this.db.run(`
            UPDATE teamsnap_teams 
            SET team_name = ?,
                division_name = ?,
                division_id = ?,
                season_name = ?,
                league_name = ?,
                organization_id = ?,
                last_synced_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE teamsnap_id = ?
          `, [
            team.name,
            team.division_name,
            team.division_id,
            team.season_name,
            team.league_name,
            team.organization_id,
            team.id
          ]);
          updatedCount++;
        } else {
          // Insert new team
          await this.db.run(`
            INSERT INTO teamsnap_teams (
              teamsnap_id, team_name, division_name, division_id,
              season_name, league_name, organization_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            team.id,
            team.name,
            team.division_name,
            team.division_id,
            team.season_name,
            team.league_name,
            team.organization_id
          ]);
          syncedCount++;
        }
      }

      console.log(`Synced ${syncedCount} new teams, updated ${updatedCount} existing teams`);

      return {
        success: true,
        synced: syncedCount,
        updated: updatedCount,
        total: syncedCount + updatedCount
      };

    } catch (error) {
      console.error('Error syncing TeamSnap teams:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all TeamSnap teams from local database
   */
  async getTeams(filters = {}) {
    try {
      let query = 'SELECT * FROM teamsnap_teams WHERE 1=1';
      const params = [];

      if (filters.division_name) {
        query += ' AND division_name LIKE ?';
        params.push(`%${filters.division_name}%`);
      }

      if (filters.season_name) {
        query += ' AND season_name LIKE ?';
        params.push(`%${filters.season_name}%`);
      }

      query += ' ORDER BY division_name, team_name';

      const teams = await this.db.all(query, params);

      return {
        success: true,
        teams: teams,
        count: teams.length
      };

    } catch (error) {
      console.error('Error fetching teams:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Assign a tryout registration to a TeamSnap team
   */
  async assignPlayerToTeam(registrationId, teamId, assignedBy = 'system') {
    try {
      // Verify registration exists
      const registration = await this.db.get(
        'SELECT * FROM tryout_registrations WHERE id = ?',
        [registrationId]
      );

      if (!registration) {
        return {
          success: false,
          error: 'Registration not found'
        };
      }

      // Verify team exists
      const team = await this.db.get(
        'SELECT * FROM teamsnap_teams WHERE id = ?',
        [teamId]
      );

      if (!team) {
        return {
          success: false,
          error: 'Team not found'
        };
      }

      // Check if assignment already exists
      const existing = await this.db.get(
        'SELECT * FROM player_assignments WHERE tryout_registration_id = ? AND teamsnap_team_id = ?',
        [registrationId, teamId]
      );

      if (existing) {
        return {
          success: false,
          error: 'Player already assigned to this team'
        };
      }

      // Create assignment
      const result = await this.db.run(`
        INSERT INTO player_assignments (
          tryout_registration_id,
          teamsnap_team_id,
          assignment_status,
          assigned_by
        ) VALUES (?, ?, 'pending', ?)
      `, [registrationId, teamId, assignedBy]);

      return {
        success: true,
        assignmentId: result.id,
        message: `${registration.first_name} ${registration.last_name} assigned to ${team.team_name}`
      };

    } catch (error) {
      console.error('Error assigning player to team:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Assign multiple players to a team
   */
  async assignPlayersToTeam(registrationIds, teamId, assignedBy = 'system') {
    try {
      const results = {
        success: true,
        assigned: 0,
        skipped: 0,
        errors: []
      };

      for (const registrationId of registrationIds) {
        const result = await this.assignPlayerToTeam(registrationId, teamId, assignedBy);
        
        if (result.success) {
          results.assigned++;
        } else {
          results.skipped++;
          results.errors.push({
            registrationId,
            error: result.error
          });
        }
      }

      return results;

    } catch (error) {
      console.error('Error in bulk assignment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all assignments for a registration
   */
  async getPlayerAssignments(registrationId) {
    try {
      const assignments = await this.db.all(`
        SELECT 
          pa.*,
          tr.first_name,
          tr.last_name,
          tr.email,
          tr.date_of_birth,
          tr.age_group,
          ts.team_name,
          ts.division_name,
          ts.season_name,
          ts.teamsnap_id
        FROM player_assignments pa
        JOIN tryout_registrations tr ON pa.tryout_registration_id = tr.id
        JOIN teamsnap_teams ts ON pa.teamsnap_team_id = ts.id
        WHERE pa.tryout_registration_id = ?
        ORDER BY pa.assigned_at DESC
      `, [registrationId]);

      return {
        success: true,
        assignments: assignments,
        count: assignments.length
      };

    } catch (error) {
      console.error('Error fetching player assignments:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all players assigned to a team
   */
  async getTeamAssignments(teamId) {
    try {
      const assignments = await this.db.all(`
        SELECT 
          pa.*,
          tr.first_name,
          tr.last_name,
          tr.email,
          tr.phone,
          tr.date_of_birth,
          tr.age_group,
          tr.parent_name,
          tr.parent_email,
          ts.team_name,
          ts.division_name,
          ts.teamsnap_id
        FROM player_assignments pa
        JOIN tryout_registrations tr ON pa.tryout_registration_id = tr.id
        JOIN teamsnap_teams ts ON pa.teamsnap_team_id = ts.id
        WHERE pa.teamsnap_team_id = ?
        ORDER BY pa.assignment_status, tr.last_name, tr.first_name
      `, [teamId]);

      // Group by status
      const grouped = {
        pending: [],
        invited: [],
        accepted: [],
        declined: [],
        registered: []
      };

      assignments.forEach(assignment => {
        const status = assignment.assignment_status || 'pending';
        if (grouped[status]) {
          grouped[status].push(assignment);
        }
      });

      return {
        success: true,
        assignments: assignments,
        grouped: grouped,
        count: assignments.length,
        summary: {
          total: assignments.length,
          pending: grouped.pending.length,
          invited: grouped.invited.length,
          accepted: grouped.accepted.length,
          declined: grouped.declined.length,
          registered: grouped.registered.length
        }
      };

    } catch (error) {
      console.error('Error fetching team assignments:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update assignment status
   */
  async updateAssignmentStatus(assignmentId, status, notes = null) {
    try {
      const validStatuses = ['pending', 'invited', 'accepted', 'declined', 'registered'];
      
      if (!validStatuses.includes(status)) {
        return {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        };
      }

      const updateFields = ['assignment_status = ?', 'updated_at = CURRENT_TIMESTAMP'];
      const params = [status];

      if (notes) {
        updateFields.push('notes = ?');
        params.push(notes);
      }

      if (status === 'invited') {
        updateFields.push('invitation_sent_at = CURRENT_TIMESTAMP');
      } else if (status === 'accepted') {
        updateFields.push('accepted_at = CURRENT_TIMESTAMP');
      }

      params.push(assignmentId);

      await this.db.run(`
        UPDATE player_assignments 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, params);

      return {
        success: true,
        message: `Assignment status updated to ${status}`
      };

    } catch (error) {
      console.error('Error updating assignment status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Remove assignment
   */
  async removeAssignment(assignmentId) {
    try {
      await this.db.run('DELETE FROM player_assignments WHERE id = ?', [assignmentId]);

      return {
        success: true,
        message: 'Assignment removed'
      };

    } catch (error) {
      console.error('Error removing assignment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary() {
    try {
      // Total registrations
      const totalRegs = await this.db.get('SELECT COUNT(*) as count FROM tryout_registrations');
      
      // Total assignments
      const totalAssignments = await this.db.get('SELECT COUNT(*) as count FROM player_assignments');
      
      // Unassigned registrations
      const unassigned = await this.db.get(`
        SELECT COUNT(*) as count 
        FROM tryout_registrations tr
        LEFT JOIN player_assignments pa ON tr.id = pa.tryout_registration_id
        WHERE pa.id IS NULL
      `);
      
      // Assignments by status
      const statusCounts = await this.db.all(`
        SELECT assignment_status, COUNT(*) as count 
        FROM player_assignments 
        GROUP BY assignment_status
      `);
      
      // Teams with assignments
      const teamsWithPlayers = await this.db.all(`
        SELECT 
          ts.id,
          ts.team_name,
          ts.division_name,
          COUNT(pa.id) as player_count
        FROM teamsnap_teams ts
        LEFT JOIN player_assignments pa ON ts.id = pa.teamsnap_team_id
        GROUP BY ts.id
        HAVING player_count > 0
        ORDER BY player_count DESC
        LIMIT 10
      `);

      const statusSummary = {};
      statusCounts.forEach(row => {
        statusSummary[row.assignment_status] = row.count;
      });

      return {
        success: true,
        summary: {
          total_registrations: totalRegs.count,
          total_assignments: totalAssignments.count,
          unassigned: unassigned.count,
          by_status: statusSummary,
          top_teams: teamsWithPlayers
        }
      };

    } catch (error) {
      console.error('Error getting dashboard summary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PlayerAssignments;






