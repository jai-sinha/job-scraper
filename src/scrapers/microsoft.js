import { logger } from '../utils/logger.js';

export async function scrapeMicrosoft(browser) {
  const page = await browser.newPage();
  const jobs = [];

  try {
    logger.info('🔍 Scraping Microsoft Careers...');

    // Navigate to Microsoft careers page with Munich location filter
    await page.goto('https://jobs.careers.microsoft.com/global/en/search?lc=Munich,%20Bavaria,%20Germany', {
      waitUntil: 'networkidle',
      timeout: 20000
    });

    // Wait for job results to load
    await page.waitForSelector('[role="listitem"]', { timeout: 10000 });

    // Extract job listings using structural selectors
    const jobElements = await page.locator('[role="listitem"]').all();

    logger.info(`Found ${jobElements.length} job elements on Microsoft Careers`);

    for (let i = 0; i < jobElements.length; i++) {
      try {
        const element = jobElements[i];

        // Extract job title from h2 element
        const titleElement = element.locator('h2').first();
        const title = await titleElement.textContent();

        if (!title || !title.trim()) continue;

        // Extract job URL - try multiple approaches
        let url = '';

        // First try: look for the DocumentCard with aria-label containing job ID
        const documentCard = element.locator('[aria-label*="Job item"]').first();
        if (await documentCard.count() > 0) {
          const ariaLabel = await documentCard.getAttribute('aria-label');
          if (ariaLabel) {
            const jobIdMatch = ariaLabel.match(/Job item (\d+)/);
            if (jobIdMatch) {
              const jobId = jobIdMatch[1];
              // Create URL slug from title
              const slug = title
                .trim()
                .replace(/[^\w\s-()]/g, '') // Remove special chars except hyphens, spaces, parentheses
                .replace(/\s+/g, '-') // Replace spaces with hyphens
                .replace(/--+/g, '-') // Replace multiple hyphens with single
                .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

              url = `https://jobs.careers.microsoft.com/global/en/job/${jobId}/${encodeURIComponent(slug)}`;
            }
          }
        }

        // Second try: look for any link in the job card (fallback)
        if (!url) {
          const linkElement = element.locator('a').first();
          if (await linkElement.count() > 0) {
            const href = await linkElement.getAttribute('href');
            if (href && href !== '#') {
              url = href.startsWith('http') ? href : `https://jobs.careers.microsoft.com${href}`;
            }
          }
        }

        // Third try: construct URL from job ID in data-automationid (fallback)
        if (!url) {
          const jobId = await element.getAttribute('data-automationid');
          if (jobId && jobId !== 'ListCell') {
            const extractedJobId = jobId.replace('ListCell', '');
            if (extractedJobId) {
              url = `https://jobs.careers.microsoft.com/global/en/job/${extractedJobId}`;
            }
          }
        }

        // Fourth try: look for the "See details" button link
        if (!url) {
          const seeDetailsLink = element.locator('button[aria-label*="See details"]').locator('xpath=ancestor::a').first();
          if (await seeDetailsLink.count() > 0) {
            const href = await seeDetailsLink.getAttribute('href');
            if (href) {
              url = href.startsWith('http') ? href : `https://jobs.careers.microsoft.com${href}`;
            }
          }
        }

        if (!url) {
          const documentCardCount = await element.locator('[aria-label*="Job item"]').count();
          const linkCount = await element.locator('a').count();
          logger.warn(`Could not extract URL for job: ${title} - DocumentCard count: ${documentCardCount}, Link count: ${linkCount}`);
          continue;
        }

        // Extract location from POI icon span
        const locationElement = element.locator('i[data-icon-name="POI"]').locator('xpath=following-sibling::span').first();
        const location = await locationElement.textContent();

        // Extract posted date from Clock icon span
        const dateElement = element.locator('i[data-icon-name="Clock"]').locator('xpath=following-sibling::span').first();
        const dateText = await dateElement.textContent();

        // Parse date - Microsoft shows relative dates like "12 days ago"
        const postedDate = parseMicrosoftDate(dateText);

        // Company is Microsoft
        const company = 'Microsoft';

        const job = {
          title: title.trim(),
          company: company,
          location: location?.trim() || 'Munich, Bavaria, Germany',
          url,
          description: '', // Can be filled later if needed
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

  if (lowerText.includes('today')) {
    return now.toISOString().split('T')[0];
  }

  if (lowerText.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  // Handle "X days ago" format
  const daysMatch = lowerText.match(/(\d+)\s*days?\s*ago/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    const pastDate = new Date(now);
    pastDate.setDate(now.getDate() - days);
    return pastDate.toISOString().split('T')[0];
  }

  // Handle "X weeks ago" format
  const weeksMatch = lowerText.match(/(\d+)\s*weeks?\s*ago/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1]);
    const pastDate = new Date(now);
    pastDate.setDate(now.getDate() - (weeks * 7));
    return pastDate.toISOString().split('T')[0];
  }

  // Default to today if we can't parse
  return now.toISOString().split('T')[0];
}
