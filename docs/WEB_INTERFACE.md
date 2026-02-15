# Hilton Heat Web Interface - User Guide

## Access the Interface

**URL:** `http://localhost:3000/hilton-heat-v2.html`

---

## Features Overview

### 📊 **Dashboard Tab**
- **Real-time Statistics**
  - Total teams (30)
  - Total registrations
  - Total assignments
  - Unassigned players

- **Quick Actions**
  - 🔄 Sync Teams from TeamSnap (pulls all 30 teams)
  - 📥 Import Registrations (navigate to registration tab)
  - ♻️ Refresh Dashboard

- **Status Summary**
  - Visual breakdown by assignment status
  - Pending, Invited, Accepted, Declined, Registered

- **Top Teams**
  - Teams ranked by player count
  - Quick access to view team rosters

---

### ⚽ **Teams Tab**
- **View All 30 TeamSnap Teams**
  - Team name, division, season, league
  - TeamSnap ID for reference
  - Last sync timestamp

- **Search & Filter**
  - Search by team name
  - Filter by division
  - Real-time filtering

- **Actions**
  - View Assignments button for each team
  - Refresh teams list

---

### 📋 **Registrations Tab**
- **View All Tryout Registrations**
  - Player name, age group, email
  - Parent information
  - Current status

- **Search & Filter**
  - Search by player name or email
  - Filter by age group
  - Filter by status

- **Selection & Bulk Actions**
  - Checkbox selection (individual or select all)
  - Bulk assign selected players to a team
  - Quick assign individual players

---

### 🎯 **Assignments Tab**
- **View Team Rosters**
  - Select team from dropdown
  - See all assigned players
  - Status summary for team

- **Player Management**
  - View full player details
  - Update assignment status
  - Remove assignments

- **Status Tracking**
  - Change status: pending → invited → accepted/declined → registered
  - Timestamps for all changes

---

## Workflow Example

### Step 1: Sync Teams
1. Go to **Dashboard** tab
2. Click "🔄 Sync Teams from TeamSnap"
3. Wait for confirmation (30 teams synced)

### Step 2: Import Registrations
1. Export CSV from TeamSnap (tryout form)
2. Use existing import API or UI
3. View in **Registrations** tab

### Step 3: Assign Players
**Option A: Quick Assign (Individual)**
1. Go to **Registrations** tab
2. Find player
3. Click "Assign" button
4. Enter team ID
5. Confirm

**Option B: Bulk Assign (Multiple)**
1. Go to **Registrations** tab
2. Check boxes next to players
3. Select team from "Bulk Actions" dropdown
4. Click "Assign Selected to Team"
5. Confirm

### Step 4: Manage Team Rosters
1. Go to **Assignments** tab
2. Select team from dropdown
3. View all assigned players
4. Update status as players progress
5. Remove assignments if needed

### Step 5: Track Progress
1. Return to **Dashboard**
2. View statistics
3. See status breakdown
4. Monitor top teams

---

## Visual Design

### Color-Coded Status Badges
- **Pending** - Yellow (⚠️ waiting for action)
- **Invited** - Blue (📧 invitation sent)
- **Accepted** - Green (✅ player accepted)
- **Declined** - Red (❌ player declined)
- **Registered** - Dark Blue (🎉 fully registered)

### Responsive Layout
- Grid layout adapts to screen size
- Mobile-friendly design
- Clean, modern interface

### Search & Filter
- Real-time filtering
- Multiple filter criteria
- Instant results

---

## Key Features

### ✅ Real-Time Data
- Dashboard updates automatically
- No manual refresh needed
- Live statistics

### ✅ Bulk Operations
- Select multiple players
- Assign in one click
- Save time on large groups

### ✅ Status Workflow
- Track player journey
- Update status easily
- Visual progress indicators

### ✅ Team Management
- View complete rosters
- Filter and search
- Quick access to details

### ✅ User-Friendly
- Clean, intuitive interface
- Color-coded information
- Helpful tooltips and labels

---

## Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

---

## Tips & Tricks

### 1. **Use Bulk Assignment**
   - Select all players from an age group
   - Assign entire group to a team
   - Much faster than individual assignments

### 2. **Filter Before Assigning**
   - Filter by age group
   - Shows only relevant players
   - Reduces errors

### 3. **Track Status Progress**
   - Update status as you contact parents
   - Know who needs follow-up
   - See acceptance rate

### 4. **Dashboard for Overview**
   - Quick snapshot of system state
   - Identify bottlenecks
   - Monitor team balance

### 5. **Search for Quick Access**
   - Find specific player quickly
   - Search by name or email
   - No scrolling through long lists

---

## Troubleshooting

### Teams Not Showing?
1. Click "Sync Teams from TeamSnap"
2. Wait 10-15 seconds
3. Refresh page if needed

### Registrations Not Appearing?
1. Ensure CSV import was successful
2. Check registrations endpoint
3. Verify database connection

### Assignment Not Saving?
1. Check team ID is valid
2. Ensure registration exists
3. Check console for errors

### Page Not Loading?
1. Verify server is running (port 3000)
2. Check Docker container status
3. View browser console for errors

---

## Keyboard Shortcuts

- **Tab Navigation**: Use mouse to switch tabs
- **Checkboxes**: Space to toggle
- **Search**: Start typing to filter
- **Dropdowns**: Arrow keys + Enter

---

## Next Steps

### Immediate Use
1. ✅ Sync teams from TeamSnap
2. ✅ Import tryout registrations
3. ✅ Start assigning players
4. ✅ Track progress

### Future Enhancements
- Email notifications on status change
- Export roster to PDF
- Parent portal for acceptances
- Mobile app version
- Automated status reminders

---

## Screenshots & Examples

### Dashboard View
- 4 stat cards at top
- Status summary cards
- Top teams table

### Teams Grid
- 3-column grid (responsive)
- Team cards with details
- Action buttons

### Registrations Table
- Full-width table
- Sortable columns
- Bulk actions footer

### Assignments View
- Team selector dropdown
- Status summary cards
- Detailed player table

---

## Support

For issues or questions:
1. Check console logs (F12 in browser)
2. Review API endpoints
3. Check Docker logs
4. Refer to PLAYER_ASSIGNMENT_GUIDE.md

---

## Summary

The Hilton Heat web interface provides a **complete, visual solution** for:
- ✅ Viewing all 30 organization teams
- ✅ Managing tryout registrations
- ✅ Assigning players to teams
- ✅ Tracking status through the workflow
- ✅ Monitoring progress with dashboards

**Everything you need in one beautiful, easy-to-use interface!** 🎉






