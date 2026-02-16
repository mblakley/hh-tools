#!/usr/bin/env node

/**
 * Export team owners, head coaches, assistant coaches, and managers
 * from Hilton Heat divisions in TeamSnap.
 *
 * Outputs two CSV files under data/exports/:
 *   - teamsnap-byga-<timestamp>.csv   (Byga upload format, deduplicated)
 *   - teamsnap-roster-<timestamp>.csv  (full roster with team names)
 *
 * Usage:
 *   node scripts/export-team-emails.js
 *
 * Requires TEAMSNAP_CLIENT_ID, TEAMSNAP_CLIENT_SECRET, TEAMSNAP_USERNAME,
 * and TEAMSNAP_PASSWORD in .env
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const TeamSnapAPI = require('../src/teamsnap-api');

// Hilton Heat division IDs on TeamSnap
const DIVISION_IDS = [974120, 974119];

// Only include members whose position matches one of these
const POSITION_FILTER = /^(head coach|asst\.? coach|assistant coach|coach|manager|team manager)$/i;

// Map raw TeamSnap position strings to standardized role names
const ROLE_MAP = {
  'head coach': 'head coach',
  'coach': 'head coach',
  'asst coach': 'assistant coach',
  'asst. coach': 'assistant coach',
  'assistant coach': 'assistant coach',
  'manager': 'manager',
  'team manager': 'manager',
  'owner': 'owner'
};

function normalizeRole(raw) {
  if (!raw) return '';
  // Handle compound roles like "Asst Coach/Manager"
  return raw.split('/').map(part => {
    const key = part.trim().toLowerCase();
    return ROLE_MAP[key] || key;
  }).join(';');
}

// Normalize phone to 585-555-1234 format
function normalizePhone(raw) {
  if (!raw) return '';
  // Strip everything except digits
  const digits = raw.replace(/\D/g, '');
  // Remove leading country code "1" if 11 digits
  const num = digits.length === 11 && digits[0] === '1'
    ? digits.slice(1) : digits;
  if (num.length !== 10) return raw; // return as-is if not 10 digits
  return `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
}

async function main() {
  const api = new TeamSnapAPI();

  // 1. Get teams and members for both divisions in parallel
  //    Uses division-level bulk queries (1 call per division instead of per-team)
  console.log('Fetching teams and members from Hilton Heat divisions...');
  const [divTeams, divMembers] = await Promise.all([
    Promise.all(DIVISION_IDS.map(id => api.getDivisionTeams(id))),
    Promise.all(DIVISION_IDS.map(id => api.getDivisionMembers(id)))
  ]);

  // Build team lookup: id -> name
  const teamMap = {};
  let teamCount = 0;
  for (const result of divTeams) {
    if (!result.success) continue;
    for (const t of result.teams) {
      teamMap[t.id] = t.name;
      teamCount++;
    }
  }

  // Collect all members and unique team IDs
  const allMembers = [];
  const teamIds = new Set();
  for (const result of divMembers) {
    if (!result.success) continue;
    for (const m of result.members) {
      allMembers.push(m);
      teamIds.add(m.team_id);
    }
  }

  console.log(`Found ${teamCount} teams, ${allMembers.length} total members`);

  // 2. Batch-fetch emails and phones for all teams at once
  //    (comma-separated team_id supported by TeamSnap API)
  const teamIdList = Array.from(teamIds).join(',');
  console.log('Fetching contact info for all teams in bulk...');
  const [emailsResult, phonesResult] = await Promise.all([
    api.getTeamMemberEmails(teamIdList),
    api.getTeamMemberPhones(teamIdList)
  ]);

  const emailMap = emailsResult.emailMap || {};
  const phoneMap = phonesResult.phoneMap || {};
  console.log(
    `  ${Object.keys(emailMap).length} emails, ` +
    `${Object.keys(phoneMap).length} phones`
  );

  // 3. Filter to coaches/managers/owners and build rows
  const seen = new Map();
  const allRows = [];

  for (const m of allMembers) {
    const positionMatch = m.position && POSITION_FILTER.test(m.position);
    if (!m.is_owner && !m.is_manager && !positionMatch) continue;

    const email = (emailMap[m.id] || m.email || '').toLowerCase();
    const phone = normalizePhone(phoneMap[m.id] || m.phone || '');
    if (!email) continue;

    const rawRole = m.position || (m.is_owner ? 'Owner' : 'Manager');
    const role = normalizeRole(rawRole);
    const teamName = teamMap[m.team_id] || `Team ${m.team_id}`;

    allRows.push({ team: teamName, firstName: m.first_name,
      lastName: m.last_name, email, phone, role });

    if (seen.has(email)) {
      const existing = seen.get(email);
      // Merge individual roles (a compound role like "assistant coach;manager"
      // may introduce multiple)
      for (const r of role.split(';')) {
        if (r && !existing.roles.includes(r)) existing.roles.push(r);
      }
    } else {
      seen.set(email, { firstName: m.first_name, lastName: m.last_name,
        email, phone, roles: role.split(';').filter(Boolean) });
    }
  }

  const bygaRows = Array.from(seen.values());
  console.log(`\nCoaches/managers/owners: ${allRows.length} total, ${bygaRows.length} unique`);

  // 4. Write CSV files to data/exports/
  const exportDir = path.join(__dirname, '..', 'data', 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const escape = v => `"${String(v).replace(/"/g, '""')}"`;
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-').slice(0, 19);

  // 4a. Byga upload format (deduplicated)
  const bygaFile = path.join(exportDir, `teamsnap-byga-${timestamp}.csv`);
  const bygaHeader = 'first_name,last_name,email,phone,roles';
  const bygaCsv = bygaRows.map(r =>
    [r.firstName, r.lastName, r.email, r.phone, r.roles.join(';')]
      .map(escape).join(',')
  );
  fs.writeFileSync(bygaFile, [bygaHeader, ...bygaCsv].join('\n'), 'utf-8');
  console.log(`Byga CSV:   ${bygaFile}`);

  // 4b. Full roster with team names
  const fullFile = path.join(exportDir, `teamsnap-roster-${timestamp}.csv`);
  const fullHeader = 'team,first_name,last_name,email,phone,role';
  const fullCsv = allRows.map(r =>
    [r.team, r.firstName, r.lastName, r.email, r.phone, r.role]
      .map(escape).join(',')
  );
  fs.writeFileSync(fullFile, [fullHeader, ...fullCsv].join('\n'), 'utf-8');
  console.log(`Roster CSV: ${fullFile}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
