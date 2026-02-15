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
