const nodemailer = require('nodemailer');

// Static team contacts map - head coaches, managers, and owners only.
// Grouped by age group prefix (e.g., "BU09" = Boys U9).
// Update this map and redeploy when rosters change.
const TEAM_CONTACTS = {
  BU09: [
    { name: 'Anthony D\'Alonzo', email: 'adalonzo2@gmail.com', team: 'BU09 - D\'Alonzo' },
    { name: 'Jeff Ford', email: 'fordjeffreya@gmail.com', team: 'BU09 - D\'Alonzo' },
    { name: 'Tracey D\'Alonzo', email: 'thedalonzos@gmail.com', team: 'BU09 - D\'Alonzo' },
    { name: 'Mike Tette', email: 'mtette12@gmail.com', team: 'BU09 - Tette' },
    { name: 'Liz Sharpe', email: 'elizabeth.c.sharpe@gmail.com', team: 'BU09 - Tette' },
  ],
  BU10: [
    { name: 'Tony Cafarelli', email: 'president@hiltonheat.com', team: 'BU10 - Wallenhorst' },
    { name: 'Brian Wallenhorst', email: 'bwallenhorst@gmail.com', team: 'BU10 - Wallenhorst' },
    { name: 'Savannah Wallenhorst', email: 'slwallenhorst@gmail.com', team: 'BU10 - Wallenhorst' },
  ],
  BU11: [
    { name: 'Jamie Miner', email: 'jlouise36@yahoo.com', team: 'BU11 - Miner' },
    { name: 'Jarrod Miner', email: 'jarrod.miner@yahoo.com', team: 'BU11 - Miner' },
    { name: 'Steven Battisti', email: 'stevenbattisti703@gmail.com', team: 'BU11 - Miner' },
    { name: 'Kyle Semrau', email: 'kylesemrau10@gmail.com', team: 'BU11 - Miner' },
    { name: 'Tiffany Meyer', email: 'tlb09708@hotmail.com', team: 'BU11 - Meyer' },
    { name: 'Jim Meyer', email: 'jamescmeyer3@gmail.com', team: 'BU11 - Meyer' },
  ],
  BU12: [
    { name: 'Vikki Schulz', email: 'wschulz@hotmail.com', team: 'BU12 - Borcyk' },
    { name: 'Justin DiPasquale', email: 'justin.dipasquale@gmail.com', team: 'BU12 - Borcyk' },
    { name: 'Ryan Borcyk', email: 'ryanborcyk@gmail.com', team: 'BU12 - Borcyk' },
    { name: 'Stefanie Glad', email: 'stefanie0124@gmail.com', team: 'BU12 - Sotile' },
    { name: 'Jacob Ostrander', email: 'jacobostrander@hotmail.com', team: 'BU12 - Sotile' },
    { name: 'Marc Sotile', email: 'joeys.place@yahoo.com', team: 'BU12 - Sotile' },
  ],
  BU13: [
    { name: 'Jasmin Efing', email: 'jasz320@hotmail.com', team: 'BU13 - Pollock' },
    { name: 'Ryan Pollock', email: 'tryfecta1023@yahoo.com', team: 'BU13 - Pollock' },
    { name: 'Eduardo Garcia', email: 'eduardo.garcia.c@gmail.com', team: 'BU13 - Garcia' },
    { name: 'Stephanie Happ', email: 'flowercitystephanie@gmail.com', team: 'BU13 - Garcia' },
  ],
  BU14: [
    { name: 'Tony Guzzetta', email: 'aguzzetta@spencerportschools.org', team: 'BU14 - Guzzetta' },
    { name: 'Ryan McNair', email: 'rymc2009@yahoo.com', team: 'BU14 - Guzzetta' },
    { name: 'Lyndsay Grimes', email: 'lyndsaygrimes3@gmail.com', team: 'BU14 - Guzzetta' },
  ],
  BU15: [
    { name: 'Nicole Flaitz', email: 'nrpaquette@yahoo.com', team: 'BU15 - Flaitz' },
    { name: 'Eric Flaitz', email: 'flaitze081580@yahoo.com', team: 'BU15 - Flaitz' },
    { name: 'Frank D\'Ambrosio', email: 'taxman0919@yahoo.com', team: 'BU15 - D\'Ambrosio' },
    { name: 'Sheri Walker', email: 'sheri1129@gmail.com', team: 'BU15 - D\'Ambrosio' },
    { name: 'Michael Tette', email: 'mtette12@gmail.com', team: 'BU15 - D\'Ambrosio' },
  ],
  BU16: [
    { name: 'Jasmin Efing', email: 'jasz320@hotmail.com', team: 'BU16 - Fromm' },
    { name: 'Tony Fromm', email: 'tony.fromm@gmail.com', team: 'BU16 - Fromm' },
    { name: 'Joe Giuliano', email: 'joeysoccer2002@yahoo.com', team: 'BU16 - Fromm' },
    { name: 'Brendon Wade', email: 'brendon.wade@constellation.com', team: 'BU16 - Fromm' },
  ],
  GU09: [
    { name: 'Sheena Sanna', email: 'sheenat@gmail.com', team: 'GU09 - Diedrich' },
    { name: 'Tyler Diedrich', email: 'tdiedrich22@gmail.com', team: 'GU09 - Diedrich' },
    { name: 'Mark Olles', email: 'mark.olles@gmail.com', team: 'GU09 - Diedrich' },
    { name: 'Dana Christensen', email: 'dkchristensen15@yahoo.com', team: 'GU09 - Christensen' },
    { name: 'Brandon White', email: 'brandonwhite1@gmail.com', team: 'GU09 - Christensen' },
  ],
  GU10: [
    { name: 'Mark Bellavia', email: 'mbellavia10@hotmail.com', team: 'GU10 - Bellavia' },
    { name: 'Lindsay Thompson', email: 'thompson14519@gmail.com', team: 'GU10 - Bellavia' },
    { name: 'Christina Vargas', email: 'cvargas8410@gmail.com', team: 'GU10 - Vargas' },
    { name: 'Annmarie Weber', email: 'annmariekandersson@gmail.com', team: 'GU10 - Vargas' },
  ],
  GU11: [
    { name: 'Kaitlyn Stagnitta', email: 'kaitlynsayers@yahoo.com', team: 'GU11 - Stagnitta' },
    { name: 'Carmen Stagnitta', email: 'cstag1@yahoo.com', team: 'GU11 - Stagnitta' },
    { name: 'Christa Bowling', email: 'christabowling@yahoo.com', team: 'GU11 - Bowling' },
    { name: 'Chris Bowling', email: 'cbowling.tremco@yahoo.com', team: 'GU11 - Bowling' },
  ],
  GU12: [
    { name: 'Karyn Prior', email: 'karyn13@aol.com', team: 'GU12 - Colavecchia' },
    { name: 'Gregory Colavecchia', email: 'gregorycolavecchia@gmail.com', team: 'GU12 - Colavecchia' },
    { name: 'Pat Shaw', email: 'patrickshaw7244@gmail.com', team: 'GU12 - Colavecchia' },
    { name: 'Liz Sharpe', email: 'elizabeth.c.sharpe@gmail.com', team: 'GU12 - Zecher' },
    { name: 'Jon Zecher', email: 'zecka84@icloud.com', team: 'GU12 - Zecher' },
  ],
  GU13: [
    { name: 'Josh Montagliano', email: 'jmontagliano@yahoo.com', team: 'GU13 - Montagliano' },
    { name: 'Katie Shedler', email: 'katiegabor@hotmail.com', team: 'GU13 - Montagliano' },
  ],
  GU14: [
    { name: 'Alane DiMartino', email: 'blaisal83@gmail.com', team: 'GU14 - DiMartino-DiGiacco' },
    { name: 'Brian DiGiacco', email: 'bdigiacco@rdgandpartners.com', team: 'GU14 - DiMartino-DiGiacco' },
  ],
  GU15: [
    { name: 'Shannon Pollock', email: 'shanie1023@yahoo.com', team: 'GU15 - Pollock' },
    { name: 'Ryan Pollock', email: 'tryfecta1023@yahoo.com', team: 'GU15 - Pollock' },
    { name: 'Josh Zaremba', email: 'joshua.zaremba@gmail.com', team: 'GU15 - Pollock' },
  ],
  GU16: [
    { name: 'Jackie Niedzwiecki', email: 'keller3583@gmail.com', team: 'GU16 - Niedzwiecki' },
    { name: 'Justin Niedzwiecki', email: 'jniedzwiecki8@gmail.com', team: 'GU16 - Niedzwiecki' },
  ],
};

const FROM_ADDRESS = '"Hilton Heat Scheduling" <webmaster@hiltonheat.com>';

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'secure.emailsrvr.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: (parseInt(process.env.SMTP_PORT) || 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildAgeGroupKey(gender, ageGroup) {
  // gender: "Boys" or "Girls", ageGroup: "U9", "U10", etc.
  const prefix = gender.toLowerCase().startsWith('b') ? 'B' : 'G';
  const age = ageGroup.toUpperCase().startsWith('U') ? ageGroup.toUpperCase() : `U${ageGroup}`;
  return `${prefix}${age}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Byga/Duda sends field names as JSON keys
    const data = req.body || {};
    const email = data['Email'] || data['email'] || '';
    const ageGroup = data['Age Group'] || data['age_group'] || data['Age group'] || '';
    const gender = data['Gender'] || data['gender'] || '';
    const message = data['Message'] || data['message'] || '';

    // Validate required fields
    if (!email || !ageGroup || !gender) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: Email, Age Group, Gender',
      });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const key = buildAgeGroupKey(gender, ageGroup);
    const contacts = TEAM_CONTACTS[key];

    if (!contacts || contacts.length === 0) {
      console.log(`No teams found for key: ${key}`);
      return res.status(404).json({
        success: false,
        error: `No teams found for ${gender} ${ageGroup}`,
      });
    }

    // Deduplicate emails
    const uniqueEmails = [...new Set(contacts.map(c => c.email))];
    const teamNames = [...new Set(contacts.map(c => c.team))];

    console.log(`Scrimmage request: ${email} → ${key} (${uniqueEmails.length} contacts)`);

    const transporter = createTransporter();

    // Send email to coaches/managers
    const coachSubject = `Scrimmage Request - ${gender} ${ageGroup}`;
    const coachHtml = `
      <h2>New Scrimmage Request</h2>
      <p>Someone has requested a scrimmage with Hilton Heat ${gender} ${ageGroup} teams.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">From:</td>
            <td style="padding:4px 0">${escapeHtml(email)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Age Group:</td>
            <td style="padding:4px 0">${escapeHtml(gender)} ${escapeHtml(ageGroup)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Message:</td>
            <td style="padding:4px 0">${escapeHtml(message || '(no message)')}</td></tr>
      </table>
      <p>Please reply directly to <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
         if you are interested in scheduling a scrimmage.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #ddd">
      <p style="color:#888;font-size:12px">
        This message was sent to all ${gender} ${ageGroup} team contacts via the
        Hilton Heat website scrimmage request form.
      </p>
    `;

    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: uniqueEmails.join(', '),
      replyTo: email,
      subject: coachSubject,
      html: coachHtml,
    });

    // Send confirmation to requester
    const confirmHtml = `
      <h2>Scrimmage Request Received</h2>
      <p>Thank you for your interest in scheduling a scrimmage with Hilton Heat!</p>
      <p>Your request has been forwarded to the coaches and managers of our
         <strong>${escapeHtml(gender)} ${escapeHtml(ageGroup)}</strong> teams:</p>
      <ul>
        ${teamNames.map(t => `<li>${escapeHtml(t)}</li>`).join('\n        ')}
      </ul>
      <p>A team representative will reach out to you directly if they are interested
         in scheduling a scrimmage.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #ddd">
      <p style="color:#888;font-size:12px">
        Hilton Heat Soccer Club &mdash;
        <a href="https://www.hiltonheat.com">www.hiltonheat.com</a>
      </p>
    `;

    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: email,
      subject: 'Hilton Heat - Scrimmage Request Received',
      html: confirmHtml,
    });

    console.log(`Scrimmage request processed: ${key}, notified ${uniqueEmails.length} contacts`);

    res.status(200).json({
      success: true,
      message: 'Scrimmage request sent successfully',
      teams: teamNames,
      contactsNotified: uniqueEmails.length,
    });
  } catch (error) {
    console.error('Scrimmage request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process scrimmage request',
    });
  }
};
