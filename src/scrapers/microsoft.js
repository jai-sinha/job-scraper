import { logger } from '../utils/logger.js';

export async function scrapeMicrosoft(browser) {
  const page = await browser.newPage();
  const jobs = [];

  try {
    logger.info('🔍 Scraping Microsoft Careers...');

    await page.goto('https://jobs.careers.microsoft.com/global/en/search?lc=Munich,%20Bavaria,%20Germany', {
      waitUntil: 'networkidle',
      timeout: 20000
    });

    await page.waitForSelector('[role="listitem"]', { timeout: 10000 });

    const jobElements = await page.locator('[role="listitem"]').all();
    logger.info(`Found ${jobElements.length} job elements on Microsoft Careers`);

    for (const element of jobElements) {
      try {
        // Extract title
        const title = await element.locator('h2').first().textContent();
        if (!title?.trim()) continue;

        // Extract job ID from aria-label and create URL
        const documentCard = element.locator('[aria-label*="Job item"]').first();
        const ariaLabel = await documentCard.getAttribute('aria-label');

        if (!ariaLabel) continue;

        const jobIdMatch = ariaLabel.match(/Job item (\d+)/);
        if (!jobIdMatch) continue;

        const jobId = jobIdMatch[1];
        const slug = title
          .trim()
          .replace(/[^\w\s-()]/g, '')
          .replace(/\s+/g, '-')
          .replace(/--+/g, '-')
          .replace(/^-|-$/g, '');

        const url = `https://jobs.careers.microsoft.com/global/en/job/${jobId}/${encodeURIComponent(slug)}`;

        // Extract posting date
        const dateText = await element.locator('i[data-icon-name="Clock"]').locator('xpath=following-sibling::span').first().textContent();
        const postedDate = parseMicrosoftDate(dateText);

        const job = {
          title: title.trim(),
          company: 'Microsoft',
          location: 'Munich, Bavaria, Germany',
          url,
          description: '',
          postedDate
        };

        jobs.push(job);
        logger.info(`✅ Extracted: ${job.title} at ${job.company}`);

      } catch (error) {
        logger.warn('Error extracting job from Microsoft element:', error.message);
      }
    }

    logger.info(`📊 Found ${jobs.length} relevant jobs from Microsoft Careers`);

  } catch (error) {
    logger.error('❌ Error scraping Microsoft Careers:', error);
  } finally {
    await page.close();
  }

  return jobs;
}

function parseMicrosoftDate(dateText) {
  if (!dateText) return new Date().toISOString().split('T')[0];

  const now = new Date();
  const lowerText = dateText.toLowerCase();

  if (lowerText.includes('today')) return now.toISOString().split('T')[0];
  if (lowerText.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  const daysMatch = lowerText.match(/(\d+)\s*days?\s*ago/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    const pastDate = new Date(now);
    pastDate.setDate(now.getDate() - days);
    return pastDate.toISOString().split('T')[0];
  }

  const weeksMatch = lowerText.match(/(\d+)\s*weeks?\s*ago/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1]);
    const pastDate = new Date(now);
    pastDate.setDate(now.getDate() - (weeks * 7));
    return pastDate.toISOString().split('T')[0];
  }

  return now.toISOString().split('T')[0];
}
