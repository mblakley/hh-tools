const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');

class TeamSnapIntegration {
  constructor(database) {
    this.db = database;
  }

  /**
   * Import tryout registrations from CSV file
   */
  async importFromCSV(filePath, season) {
    try {
      console.log(`Importing tryout registrations from CSV: ${filePath}`);

      const fileExtension = path.extname(filePath).toLowerCase();
      let data = [];

      if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        data = await this.parseExcelFile(filePath);
      } else {
        data = await this.parseCSVFile(filePath);
      }

      const imported = [];
      const errors = [];

      for (const row of data) {
        try {
          // Map CSV columns to our database schema (support multiple formats)
          const registration = {
            first_name: row.first_name || row.firstName || row['First Name'] || '',
            last_name: row.last_name || row.lastName || row['Last Name'] || '',
            email: row.email || row['Email'] || '',
            phone: row.phone || row['Phone'] || '',
            date_of_birth: row.date_of_birth || row.dateOfBirth || row['Date of Birth'] || null,
            parent_name: row.parent_name || row.parentName || row['Parent Name'] || '',
            parent_email: row.parent_email || row.parentEmail || row['Parent Email'] || row.email || row['Email'] || '',
            age_group: row.age_group || row.ageGroup || row['Age Group'] || '',
            season: season,
            source: 'csv',
            external_id: row.id || row['ID'] || null,
            notes: row.notes || row['Notes'] || ''
          };

          // Validate required fields
          if (!registration.first_name || !registration.last_name || !registration.email || !registration.age_group) {
            errors.push(`Missing required fields for ${registration.first_name} ${registration.last_name}`);
            continue;
          }

          // Check if player already exists
          const existing = await this.db.get(
            'SELECT id FROM tryout_registrations WHERE first_name = ? AND last_name = ? AND email = ? AND season = ?',
            [registration.first_name, registration.last_name, registration.email, season]
          );

          if (existing) {
            console.log(`Player ${registration.first_name} ${registration.last_name} already exists, skipping`);
            continue;
          }

          // Insert new registration
          const result = await this.db.run(
            `INSERT INTO tryout_registrations
             (first_name, last_name, email, phone, date_of_birth, parent_name, parent_email,
              age_group, season, source, external_id, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              registration.first_name, registration.last_name, registration.email,
              registration.phone, registration.date_of_birth, registration.parent_name,
              registration.parent_email, registration.age_group, registration.season,
              registration.source, registration.external_id, registration.notes
            ]
          );

          imported.push({
            id: result.id,
            name: `${registration.first_name} ${registration.last_name}`,
            age_group: registration.age_group
          });

        } catch (error) {
          console.error(`Error importing row:`, error);
          errors.push(`Error importing ${row.firstName || 'Unknown'} ${row.lastName || ''}: ${error.message}`);
        }
      }

      return {
        success: true,
        imported: imported.length,
        errors: errors.length,
        details: {
          imported,
          errors
        }
      };

    } catch (error) {
      console.error('Error importing from CSV:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse CSV file
   */
  async parseCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  /**
   * Parse Excel file
   */
  async parseExcelFile(filePath) {
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet);

      return jsonData;
    } catch (error) {
      throw new Error(`Error parsing Excel file: ${error.message}`);
    }
  }

  /**
   * Export tryout registrations to CSV for coaches
   */
  async exportToCSV(ageGroup = null, season = null) {
    try {
      console.log('Exporting tryout registrations to CSV...');

      let whereClause = '';
      let params = [];

      if (ageGroup) {
        whereClause += ' WHERE age_group = ?';
        params.push(ageGroup);
      }

      if (season) {
        if (whereClause) {
          whereClause += ' AND season = ?';
        } else {
          whereClause += ' WHERE season = ?';
        }
        params.push(season);
      }

      const registrations = await this.db.all(
        `SELECT * FROM tryout_registrations${whereClause} ORDER BY age_group, last_name, first_name`,
        params
      );

      // Add empty columns for coach evaluation
      const exportData = registrations.map(reg => ({
        'First Name': reg.first_name,
        'Last Name': reg.last_name,
        'Email': reg.email,
        'Phone': reg.phone || '',
        'Date of Birth': reg.date_of_birth || '',
        'Parent Name': reg.parent_name || '',
        'Parent Email': reg.parent_email || '',
        'Age Group': reg.age_group,
        'Season': reg.season,
        'Registration Date': reg.registration_date,
        'Invite': '', // Empty column for coaches to fill
        'Notes': reg.notes || '',
        'ID': reg.id
      }));

      return {
        success: true,
        data: exportData,
        count: exportData.length
      };

    } catch (error) {
      console.error('Error exporting to CSV:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import coach evaluations from CSV
   */
  async importEvaluationsFromCSV(filePath, teamId, evaluatedBy) {
    try {
      console.log(`Importing evaluations from CSV: ${filePath}`);

      const data = await this.parseCSVFile(filePath);
      const processed = [];
      const errors = [];

      for (const row of data) {
        try {
          const inviteStatus = (row.Invite || '').toLowerCase().trim();
          if (!inviteStatus || !['yes', 'no', 'maybe'].includes(inviteStatus)) {
            continue; // Skip rows without valid invite status
          }

          // Find the registration by name and age group
          const registration = await this.db.get(
            `SELECT id FROM tryout_registrations
             WHERE first_name = ? AND last_name = ? AND age_group = ?
             AND id = ?`,
            [row['First Name'], row['Last Name'], row['Age Group'], row.ID]
          );

          if (!registration) {
            errors.push(`Player ${row['First Name']} ${row['Last Name']} not found`);
            continue;
          }

          // Check if evaluation already exists
          const existing = await this.db.get(
            'SELECT id FROM player_evaluations WHERE tryout_registration_id = ? AND team_id = ?',
            [registration.id, teamId]
          );

          if (existing) {
            // Update existing evaluation
            await this.db.run(
              `UPDATE player_evaluations
               SET invite_status = ?, notes = ?, evaluated_by = ?, evaluated_at = CURRENT_TIMESTAMP
               WHERE tryout_registration_id = ? AND team_id = ?`,
              [inviteStatus, row.Notes || '', evaluatedBy, registration.id, teamId]
            );
          } else {
            // Insert new evaluation
            await this.db.run(
              `INSERT INTO player_evaluations
               (tryout_registration_id, team_id, invite_status, notes, evaluated_by)
               VALUES (?, ?, ?, ?, ?)`,
              [registration.id, teamId, inviteStatus, row.Notes || '', evaluatedBy]
            );
          }

          processed.push({
            player: `${row['First Name']} ${row['Last Name']}`,
            status: inviteStatus
          });

        } catch (error) {
          console.error(`Error processing row:`, error);
          errors.push(`Error processing ${row['First Name']} ${row['Last Name']}: ${error.message}`);
        }
      }

      return {
        success: true,
        processed: processed.length,
        errors: errors.length,
        details: {
          processed,
          errors
        }
      };

    } catch (error) {
      console.error('Error importing evaluations from CSV:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get tryout registrations for a specific age group and season
   */
  async getRegistrations(ageGroup = null, season = null) {
    try {
      let whereClause = '';
      let params = [];

      if (ageGroup) {
        whereClause += ' WHERE age_group = ?';
        params.push(ageGroup);
      }

      if (season) {
        if (whereClause) {
          whereClause += ' AND tr.season = ?';
        } else {
          whereClause += ' WHERE tr.season = ?';
        }
        params.push(season);
      }

      const registrations = await this.db.all(
        `SELECT tr.*,
                pe.invite_status,
                pe.rating,
                pe.notes as evaluation_notes,
                t.name as team_name
         FROM tryout_registrations tr
         LEFT JOIN player_evaluations pe ON tr.id = pe.tryout_registration_id
         LEFT JOIN teams t ON pe.team_id = t.id
         ${whereClause}
         ORDER BY tr.age_group, tr.last_name, tr.first_name`,
        params
      );

      return {
        success: true,
        registrations
      };

    } catch (error) {
      console.error('Error getting registrations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = TeamSnapIntegration;


