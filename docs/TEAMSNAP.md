# TeamSnap Integration Guide

This guide covers setting up and using TeamSnap integration for the Hilton Heat registration system.

## Quick Setup

### 1. Add Credentials to .env

```bash
# TeamSnap OAuth Client Credentials (already configured)
TEAMSNAP_CLIENT_ID=your_client_id
TEAMSNAP_CLIENT_SECRET=your_client_secret

# Your TeamSnap User Credentials
TEAMSNAP_USERNAME=your_email@example.com
TEAMSNAP_PASSWORD=your_teamsnap_password
```

**Important:** Use the same email and password you use to log into https://go.teamsnap.com

### 2. Restart Docker Container

```bash
docker-compose -f docker-compose.dev.yml restart hilton-heat-dev
```

### 3. Test the Connection

```bash
# Sync teams from TeamSnap
curl -X POST http://localhost:3000/api/hilton-heat/teamsnap/sync-teams
```

## How It Works

The system uses **OAuth 2.0 Resource Owner Password Credentials** grant:

1. Your credentials + OAuth client credentials → Access Token
2. Access token has full user-level permissions
3. Can access all organizations and forms your account has access to

## Features

### Team Synchronization

Sync all teams from your TeamSnap organizations:

```bash
POST /api/hilton-heat/teamsnap/sync-teams
```

This pulls:
- Team names
- Division information
- Season details
- TeamSnap IDs for future API calls

### Roster Management

Get team rosters with member details:

```bash
GET /api/hilton-heat/teamsnap/teams/:teamId/members
```

Returns player information including:
- Player names
- Jersey numbers
- Contact information
- Parent details

### Organization Access

The API can access:
- ✅ All teams in your organizations
- ✅ Team rosters and member data
- ✅ Basic team information
- ❌ Registration form data (requires session auth)

## Export Team Contacts Script

Export names, emails, and phone numbers for coaches, managers, and owners
from Hilton Heat TeamSnap divisions. Produces two CSV files:

### Usage

```bash
node scripts/export-team-emails.js
```

### Output Files (saved to `data/exports/`)

| File | Description |
|------|-------------|
| `teamsnap-byga-<timestamp>.csv` | Byga upload format (deduplicated by email) |
| `teamsnap-roster-<timestamp>.csv` | Full roster with team names |

### Byga CSV Format

```
first_name,last_name,email,phone,roles
```

- `roles` — semicolon-separated: `head coach`, `assistant coach`, `manager`, `owner`
- `phone` — normalized to `585-555-1234` format
- Duplicate emails across teams are merged (roles combined)

### Roster CSV Format

```
team,first_name,last_name,email,phone,role
```

- One row per person per team (not deduplicated)
- Useful for seeing which team each person belongs to

### What It Fetches

The script pulls from two Hilton Heat divisions (IDs `974120` and `974119`)
and includes only members who are:

- Team owners (`is_owner` flag)
- Team managers (`is_manager` flag)
- Members with position: Head Coach, Assistant Coach, Coach, or Manager

### API Efficiency

Uses bulk TeamSnap API queries to minimize requests:

- **Division-level member search** — 1 call per division instead of per-team
- **Comma-separated team_id** — batch email/phone lookups in 2 calls total
- Total: ~6 API calls regardless of team count

### Role Normalization

| Raw TeamSnap Value | Normalized |
|---------------------|-----------|
| Head Coach | head coach |
| Coach | head coach |
| Asst Coach | assistant coach |
| Asst. Coach | assistant coach |
| Assistant Coach | assistant coach |
| Manager | manager |
| Team Manager | manager |
| Owner | owner |
| Asst Coach/Manager | assistant coach;manager |

## Troubleshooting

### "Invalid username or password"
- Double-check your TeamSnap email and password
- Verify you can log in at https://go.teamsnap.com
- Ensure credentials are properly set in `.env`

### "401 Unauthorized" after authentication
- Your account may not have access to the organization
- Verify organization/team IDs are correct
- Check that your account has manager/admin access

### "404 Not Found" for teams
- Team ID may be incorrect
- Team may have been deleted or archived
- Verify the team exists in your TeamSnap account

### Teams not syncing
- Check Docker logs: `docker-compose logs -f`
- Verify credentials in `.env` are correct
- Ensure network connectivity to TeamSnap API
- Try restarting the container

## API Limitations

### What Works
- Team roster access via public API (v3)
- Member data retrieval
- Organization browsing
- OAuth token-based authentication

### What Doesn't Work
- Registration form exports (requires browser session)
- Direct form data access via API
- Some administrative features

For registration data, you need to:
1. Log into TeamSnap web interface
2. Manually export form results as CSV
3. Import the CSV into the Hilton Heat system

## Web Interface Usage

Access the TeamSnap features through the Hilton Heat dashboard:

1. Open http://localhost:3000/hilton-heat-v2.html
2. Go to the **Teams** tab
3. Click **Sync Teams** to pull latest data from TeamSnap
4. View team rosters and assignments

## Security Notes

- OAuth tokens are temporary and refresh automatically
- Never commit your `.env` file with real credentials
- Credentials are only stored on your server, not in TeamSnap API
- Use environment variables for all sensitive data
