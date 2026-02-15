module.exports = async (req, res) => {
  const results = { steps: [] };

  // Step 1: Try loading cheerio
  try {
    require('cheerio');
    results.steps.push({ step: 'require cheerio', status: 'ok' });
  } catch (e) {
    results.steps.push({ step: 'require cheerio', status: 'fail', error: e.message });
  }

  // Step 2: Try loading puppeteer-core
  try {
    require('puppeteer-core');
    results.steps.push({ step: 'require puppeteer-core', status: 'ok' });
  } catch (e) {
    results.steps.push({ step: 'require puppeteer-core', status: 'fail', error: e.message });
  }

  // Step 3: Try loading @sparticuz/chromium
  try {
    const chromium = require('@sparticuz/chromium');
    results.steps.push({
      step: 'require @sparticuz/chromium',
      status: 'ok',
      headless: chromium.headless,
      args: chromium.args ? chromium.args.length + ' args' : 'none'
    });
  } catch (e) {
    results.steps.push({ step: 'require @sparticuz/chromium', status: 'fail', error: e.message });
  }

  // Step 4: Try loading the scraper module
  try {
    require('../src/scraper-serverless');
    results.steps.push({ step: 'require scraper-serverless', status: 'ok' });
  } catch (e) {
    results.steps.push({ step: 'require scraper-serverless', status: 'fail', error: e.message });
  }

  // Step 5: Try getting chromium executable path
  try {
    const chromium = require('@sparticuz/chromium');
    const execPath = await chromium.executablePath();
    results.steps.push({ step: 'chromium.executablePath()', status: 'ok', path: execPath });
  } catch (e) {
    results.steps.push({ step: 'chromium.executablePath()', status: 'fail', error: e.message });
  }

  res.status(200).json(results);
};
