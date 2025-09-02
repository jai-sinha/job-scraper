import { logger } from '../utils/logger.js';

export async function scrapeBMW(browser) {
  const page = await browser.newPage();
  const jobs = [];

  try {
    logger.info('🔍 Scraping BMW Careers...');

    // Navigate to BMW careers page
    await page.goto('https://www.bmwgroup.jobs/en.html', {
      waitUntil: 'networkidle',
      timeout: 20000
    });

    // Wait for the page to load and search elements to be available
    await page.waitForSelector('.grp-text-search', { timeout: 5000 });

    // Enter "software" in the search bar
    await page.fill('.grp-text-search', 'software');

    // Click the search button
    await page.click('.grp-text-search-icon');

    // Wait for search results to load
    await page.waitForSelector('.grp-jobfinder__wrapper', { timeout: 5000 });

    // Set location filter to Munich
    // First, open the location dropdown
    await page.click('.grp-dropdown-button[title="Location filter"]');

    // Wait for dropdown to open
    await page.waitForSelector('.grp-multi-dropdown-container .grp-show', { timeout: 5000 });

    // Check the Munich checkbox
    await page.check('#location_DE\\/Munich');

    // Wait for results to update after applying filter
    await page.waitForTimeout(2000);

    // Extract job listings
    const jobElements = await page.locator('.grp-jobfinder__wrapper').all();

    logger.info(`Found ${jobElements.length} job elements on BMW Careers`);

    for (let i = 0; i < jobElements.length; i++) {
      try {
        const element = jobElements[i];

        // Extract job title
        const titleElement = element.locator('.grp-jobfinder__cell-title');
        const title = await titleElement.textContent();

        if (!title || !title.trim()) continue;

        // Extract job URL
        const linkElement = element.locator('.grp-popup-link-js');
        const relativeUrl = await linkElement.getAttribute('href');
        const url = relativeUrl ? `https://www.bmwgroup.jobs${relativeUrl}` : '';

        if (!url) continue;

        // Extract location
        const locationElement = element.locator('.grp-jobfinder-cell-location');
        const location = await locationElement.textContent();

        // Extract publication date
        const dateElement = element.locator('.grp-jobfinder__cell-publication');
        const dateText = await dateElement.textContent();
        // Parse date from "Published: DD.MM.YYYY" format
        const dateMatch = dateText.match(/Published:\s*(\d{2}\.\d{2}\.\d{4})/);
        const postedDate = dateMatch ? dateMatch[1].split('.').reverse().join('-') : new Date().toISOString().split('T')[0];

        // Company is BMW
        const company = 'BMW Group';

        const job = {
          title: title.trim(),
          company: company,
          location: location?.trim() || 'Munich, Germany',
          url,
          description: '', // Can be filled later if needed
          postedDate
        };

        jobs.push(job);

        logger.info(`✅ Extracted: ${job.title} at ${job.company}`);

      } catch (error) {
        logger.warn('Error extracting job from BMW element:', error.message);
      }
    }

    logger.info(`📊 Found ${jobs.length} relevant jobs from BMW Careers`);

  } catch (error) {
    logger.error('❌ Error scraping BMW Careers:', error);
  } finally {
    await page.close();
  }

  return jobs;
}
