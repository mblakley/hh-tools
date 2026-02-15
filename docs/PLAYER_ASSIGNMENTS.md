# Player Assignment System - Complete Guide

## Overview

The Hilton Heat Player Assignment System allows you to:
1. **Import tryout registrations** from TeamSnap (via CSV export)
2. **Sync all organization teams** from TeamSnap API (30 teams across 37 divisions)
3. **Assign players to teams** with status tracking
4. **Manage the entire registration workflow** from tryout to team placement

---

## Complete Workflow

### Step 1: Import Tryout Registrations

**Method: CSV Export from TeamSnap**

1. Export tryout registration form (26146 or 26140) from TeamSnap:
   - Go to: `https://organization.teamsnap.com/organizations/60195/registration/{formId}/details`
   - Click "Export" button
   - Save as CSV

2. Import to Hilton Heat:
   ```bash
   POST /api/hilton-heat/registrations/import
   Content-Type: multipart/form-data
   
   {
     "file": <csv_file>,
     "season": "2025-26"
   }
   ```

   **Example Response:**
   ```json
   {
     "success": true,
     "imported": 45,
     "errors": 0,
     "details": {
       "imported": [
         { "id": 1, "name": "John Doe", "ageGroup": "U12" },
         { "id": 2, "name": "Jane Smith", "ageGroup": "U14" },
         ...
       ]
     }
   }
   ```

---

### Step 2: Sync TeamSnap Teams to Database

**This caches all 30 teams from TeamSnap into the local database for faster access**

```bash
POST /api/hilton-heat/assignments/sync-teams
```

**Response:**
```json
{
  "success": true,
  "synced": 30,
  "updated": 0,
  "total": 30
}
```

**What gets synced:**
- Team name (e.g., "BU12 - Sotile", "BU14 - Guzzetta")
- Division name (e.g., "Boys 2025-26")
- Season, league, organization info
- TeamSnap team ID for API access

---

### Step 3: View Available Teams

```bash
GET /api/hilton-heat/assignments/teams
```

**Optional filters:**
```bash
GET /api/hilton-heat/assignments/teams?division=Boys%202025-26
GET /api/hilton-heat/assignments/teams?season=2025-26
```

**Response:**
```json
{
  "success": true,
  "teams": [
    {
      "id": 1,
      "teamsnap_id": "10198715",
      "team_name": "BU12 - Sotile",
      "division_name": "Boys 2025-26",
      "season_name": "",
      "league_name": "Hilton Heat Soccer Club",
      "member_count": 0,
      "last_synced_at": "2025-10-13T12:00:00Z"
    },
    {
      "id": 2,
      "teamsnap_id": "10198718",
      "team_name": "BU14 - Guzzetta",
      "division_name": "Boys 2025-26",
      ...
    }
  ],
  "count": 30
}
```

---

### Step 4: Assign Players to Teams

**Single Assignment:**
```bash
POST /api/hilton-heat/assignments/assign
Content-Type: application/json

{
  "registrationId": 5,
  "teamId": 1,
  "assignedBy": "Coach Smith"
}
```

**Response:**
```json
{
  "success": true,
  "assignmentId": 1,
  "message": "John Doe assigned to BU12 - Sotile"
}
```

**Bulk Assignment:**
```bash
POST /api/hilton-heat/assignments/assign-bulk
Content-Type: application/json

{
  "registrationIds": [5, 12, 18, 24, 30],
  "teamId": 1,
  "assignedBy": "Coach Smith"
}
```

**Response:**
```json
{
  "success": true,
  "assigned": 5,
  "skipped": 0,
  "errors": []
}
```

---

### Step 5: View Team Assignments

**Get all players assigned to a team:**
```bash
GET /api/hilton-heat/assignments/team/1
```

**Response:**
```json
{
  "success": true,
  "assignments": [
    {
      "id": 1,
      "tryout_registration_id": 5,
      "teamsnap_team_id": 1,
      "assignment_status": "pending",
      "assigned_by": "Coach Smith",
      "assigned_at": "2025-10-13T12:30:00Z",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@email.com",
      "phone": "555-1234",
      "date_of_birth": "2014-03-15",
      "age_group": "U12",
      "parent_name": "Jane Doe",
      "parent_email": "jane.doe@email.com",
      "team_name": "BU12 - Sotile",
      "division_name": "Boys 2025-26"
    },
    ...
  ],
  "grouped": {
    "pending": [5 players],
    "invited": [3 players],
    "accepted": [2 players],
    "declined": [0 players],
    "registered": [1 player]
  },
  "count": 11,
  "summary": {
    "total": 11,
    "pending": 5,
    "invited": 3,
    "accepted": 2,
    "declined": 0,
    "registered": 1
  }
}
```

---

### Step 6: Track Assignment Status

**Update status as players progress through the workflow:**

```bash
PUT /api/hilton-heat/assignments/1/status
Content-Type: application/json

{
  "status": "invited",
  "notes": "Invitation email sent on 2025-10-13"
}
```

**Valid Statuses:**
- `pending` - Player assigned but not yet contacted
- `invited` - Invitation sent to player/parent
- `accepted` - Player accepted the invitation
- `declined` - Player declined the invitation
- `registered` - Player fully registered on TeamSnap

---

### Step 7: Dashboard Summary

**Get overview of all assignments:**
```bash
GET /api/hilton-heat/assignments/dashboard/summary
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total_registrations": 45,
    "total_assignments": 38,
    "unassigned": 7,
    "by_status": {
      "pending": 15,
      "invited": 12,
      "accepted": 8,
      "declined": 2,
      "registered": 1
    },
    "top_teams": [
      {
        "id": 1,
        "team_name": "BU12 - Sotile",
        "division_name": "Boys 2025-26",
        "player_count": 11
      },
      {
        "id": 2,
        "team_name": "BU14 - Guzzetta",
        "division_name": "Boys 2025-26",
        "player_count": 9
      }
    ]
  }
}
```

---

## Database Schema

### tryout_registrations
- Stores all players who registered for tryouts
- Imported from CSV export

### teamsnap_teams
- Cached copy of all 30 teams from TeamSnap
- Synced via API

### player_assignments
- Links registrations to teams
- Tracks status through the workflow
- Records assignment history

---

## Complete Example Workflow

```bash
# 1. Import tryout registrations from CSV
curl -X POST http://localhost:3000/api/hilton-heat/registrations/import \
  -F "file=@tryout_registrations.csv" \
  -F "season=2025-26"

# 2. Sync all TeamSnap teams to database
curl -X POST http://localhost:3000/api/hilton-heat/assignments/sync-teams

# 3. View available teams
curl http://localhost:3000/api/hilton-heat/assignments/teams

# 4. Assign a player to BU12 - Sotile (team ID 1)
curl -X POST http://localhost:3000/api/hilton-heat/assignments/assign \
  -H "Content-Type: application/json" \
  -d '{"registrationId": 5, "teamId": 1, "assignedBy": "Coach Smith"}'

# 5. Assign multiple players to the team
curl -X POST http://localhost:3000/api/hilton-heat/assignments/assign-bulk \
  -H "Content-Type: application/json" \
  -d '{"registrationIds": [6,7,8,9,10], "teamId": 1, "assignedBy": "Coach Smith"}'

# 6. View team roster
curl http://localhost:3000/api/hilton-heat/assignments/team/1

# 7. Update assignment status when invitation is sent
curl -X PUT http://localhost:3000/api/hilton-heat/assignments/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "invited", "notes": "Email sent"}'

# 8. View dashboard summary
curl http://localhost:3000/api/hilton-heat/assignments/dashboard/summary
```

---

## Benefits

### ✅ Complete Integration
- Tryout registrations from TeamSnap (CSV)
- Team data from TeamSnap API (30 teams)
- All managed in one system

### ✅ Flexible Assignment
- Assign individuals or bulk
- Track multiple teams per player
- View by player or by team

### ✅ Status Tracking
- 5 status levels: pending → invited → accepted/declined → registered
- Timeline of all changes
- Notes for each assignment

### ✅ Reporting
- Dashboard summary
- Team rosters with assignments
- Unassigned players list
- Status breakdowns

---

## Next Steps

### Immediate Use
1. ✅ Import tryout CSV
2. ✅ Sync teams from TeamSnap
3. ✅ Start assigning players

### Future Enhancements
- Email notifications when status changes
- Auto-sync with TeamSnap on schedule
- Export team rosters to CSV
- Parent portal for accepting invitations
- Integration with TeamSnap to add players directly to teams (if API supports)

---

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/hilton-heat/assignments/sync-teams` | POST | Sync TeamSnap teams to database |
| `/api/hilton-heat/assignments/teams` | GET | List all available teams |
| `/api/hilton-heat/assignments/assign` | POST | Assign one player to a team |
| `/api/hilton-heat/assignments/assign-bulk` | POST | Assign multiple players to a team |
| `/api/hilton-heat/assignments/player/:id` | GET | View all teams for a player |
| `/api/hilton-heat/assignments/team/:id` | GET | View all players for a team |
| `/api/hilton-heat/assignments/:id/status` | PUT | Update assignment status |
| `/api/hilton-heat/assignments/:id` | DELETE | Remove an assignment |
| `/api/hilton-heat/assignments/dashboard/summary` | GET | Dashboard overview |

---

## Conclusion

You now have a **complete player assignment system** that:
- ✅ Imports tryout registrations from TeamSnap CSV exports
- ✅ Accesses all 30 teams across your organization via TeamSnap API
- ✅ Assigns players to teams with full status tracking
- ✅ Provides dashboards and reports
- ✅ Manages the entire workflow from tryout to team placement

**The system is ready to use!** 🎉






