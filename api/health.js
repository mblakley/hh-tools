module.exports = async (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasRdyslUsername: !!process.env.RDYSL_USERNAME,
      hasRdyslPassword: !!process.env.RDYSL_PASSWORD,
      nodeVersion: process.version
    }
  });
};
