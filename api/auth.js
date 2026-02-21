module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const referer = req.headers.referer || req.headers.referrer || '';
  const isFromByga = referer.includes('hiltonheat.byga.net');

  if (!isFromByga) {
    return res.redirect(302, '/login.html');
  }

  const maxAge = 24 * 60 * 60; // 24 hours
  res.setHeader(
    'Set-Cookie',
    `hh_access=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );

  return res.redirect(302, '/');
};
