const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'hilton_heat.db');

      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database');
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  async createTables() {
    const tables = [
      // Teams table - defines age groups and their coaches
      `CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age_group TEXT NOT NULL,
        season TEXT NOT NULL,
        coach_name TEXT NOT NULL,
        coach_email TEXT NOT NULL,
        max_players INTEGER DEFAULT 18,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Tryout registrations - players who signed up for tryouts
      `CREATE TABLE IF NOT EXISTS tryout_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        date_of_birth DATE,
        parent_name TEXT,
        parent_email TEXT,
        age_group TEXT NOT NULL,
        season TEXT NOT NULL,
        registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        source TEXT DEFAULT 'teamsnap', -- teamsnap, manual, csv
        external_id TEXT, -- ID from TeamSnap or other external system
        notes TEXT,
        status TEXT DEFAULT 'pending', -- pending, invited, registered, rejected
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Player evaluations - coach assessments during tryouts
      `CREATE TABLE IF NOT EXISTS player_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tryout_registration_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        notes TEXT,
        invite_status TEXT DEFAULT 'pending', -- pending, yes, no, maybe
        evaluated_by TEXT NOT NULL,
        evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tryout_registration_id) REFERENCES tryout_registrations(id),
        FOREIGN KEY (team_id) REFERENCES teams(id),
        UNIQUE(tryout_registration_id, team_id)
      )`,

      // Registration invitations - emails sent to players
      `CREATE TABLE IF NOT EXISTS registration_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tryout_registration_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        registration_link TEXT NOT NULL,
        email_sent_at DATETIME,
        email_opened_at DATETIME,
        registration_completed_at DATETIME,
        status TEXT DEFAULT 'sent', -- sent, opened, completed, expired
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tryout_registration_id) REFERENCES tryout_registrations(id),
        FOREIGN KEY (team_id) REFERENCES teams(id),
        UNIQUE(tryout_registration_id, team_id)
      )`,

      // Registration status - tracks acceptances and rejections
      `CREATE TABLE IF NOT EXISTS registration_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invitation_id INTEGER NOT NULL,
        status TEXT NOT NULL, -- accepted, rejected, pending
        status_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        processed_by TEXT,
        FOREIGN KEY (invitation_id) REFERENCES registration_invitations(id)
      )`,

      // System settings
      `CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Email templates
      `CREATE TABLE IF NOT EXISTS email_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_name TEXT UNIQUE NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // TeamSnap teams - cache of teams from TeamSnap API
      `CREATE TABLE IF NOT EXISTS teamsnap_teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teamsnap_id TEXT UNIQUE NOT NULL,
        team_name TEXT NOT NULL,
        division_name TEXT,
        division_id TEXT,
        season_name TEXT,
        league_name TEXT,
        organization_id TEXT,
        last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        member_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Player assignments - links tryout registrations to TeamSnap teams
      `CREATE TABLE IF NOT EXISTS player_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tryout_registration_id INTEGER NOT NULL,
        teamsnap_team_id INTEGER NOT NULL,
        assignment_status TEXT DEFAULT 'pending', -- pending, invited, accepted, declined, registered
        assigned_by TEXT,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        invitation_sent_at DATETIME,
        accepted_at DATETIME,
        teamsnap_member_id TEXT, -- ID from TeamSnap once player is added to team
        FOREIGN KEY (tryout_registration_id) REFERENCES tryout_registrations(id),
        FOREIGN KEY (teamsnap_team_id) REFERENCES teamsnap_teams(id),
        UNIQUE(tryout_registration_id, teamsnap_team_id)
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }

    // Insert default settings
    await this.initializeDefaultSettings();

    // Insert default email templates
    await this.initializeDefaultEmailTemplates();
  }

  async initializeDefaultSettings() {
    const defaultSettings = [
      { key: 'registration_link_base', value: 'https://go.teamsnap.com/register/' },
      { key: 'email_from_address', value: 'registrations@hiltonheat.com' },
      { key: 'email_from_name', value: 'Hilton Heat Soccer Club' },
      { key: 'invitation_expiry_days', value: '7' }
    ];

    for (const setting of defaultSettings) {
      await this.run(
        'INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
        [setting.key, setting.value]
      );
    }
  }

  async initializeDefaultEmailTemplates() {
    const defaultTemplates = [
      {
        name: 'invitation',
        subject: 'Congratulations {{player_name}}! You\'ve been invited to join Hilton Heat {{team_name}}',
        body: `Dear {{parent_name}},

Congratulations! {{player_name}} has been selected to join the Hilton Heat {{team_name}} for the {{season}} season!

We're excited to have {{player_name}} as part of our team. To complete the registration process, please click the link below:

{{registration_link}}

This invitation expires on {{expiry_date}}.

If you have any questions, please contact your coach {{coach_name}} at {{coach_email}}.

Go Heat!

Hilton Heat Soccer Club`
      }
    ];

    for (const template of defaultTemplates) {
      await this.run(
        'INSERT OR IGNORE INTO email_templates (template_name, subject, body) VALUES (?, ?, ?)',
        [template.name, template.subject, template.body]
      );
    }
  }

  // Generic database operations
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Close database connection
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;

