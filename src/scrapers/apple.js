import { logger } from '../utils/logger.js';

export async function scrapeApple(browser) {
  const page = await browser.newPage();
  const jobs = [];

  try {
    logger.info('🔍 Scraping Apple Careers...');

    await page.goto('https://jobs.apple.com/en-us/search?location=munich-MUN&key=software', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait a bit more for dynamic content to load
    await page.waitForTimeout(3000);

    // Wait for job listings to load - be more specific about job items vs filter accordions
    await page.waitForSelector('.rc-accordion-item[role="listitem"]', { timeout: 15000 });

    const jobElements = await page.locator('.rc-accordion-item[role="listitem"]').all();
    logger.info(`Found ${jobElements.length} job listing elements on Apple Careers`);

    // Debug: Check what we actually found
    if (jobElements.length > 0) {
      const firstElement = jobElements[0];
      const html = await firstElement.innerHTML();
      logger.info(`First job element HTML preview: ${html.substring(0, 300)}...`);
    }

    for (const element of jobElements) {
      try {
        // Check if element is visible and contains job data
        const isVisible = await element.isVisible();
        if (!isVisible) continue;

        // Extract title and URL from the h3 a tag
        const titleLink = element.locator('h3 a').first();
        const titleExists = await titleLink.count() > 0;
        
        if (!titleExists) {
          logger.warn('No h3 a element found in this job item, skipping...');
          continue;
        }

        const title = await titleLink.textContent({ timeout: 5000 });
        const href = await titleLink.getAttribute('href', { timeout: 5000 });

        if (!title?.trim() || !href) {
          logger.warn('Missing title or href, skipping...');
          continue;
        }

        // Extract job ID from href (pattern: /en-us/details/{jobId}/... or /en-us/details/{jobId}-{suffix}/...)
        const hrefMatch = href.match(/\/details\/(\d+)(?:-\d+)?\//);
        if (!hrefMatch) {
          logger.warn(`Could not extract job ID from href: ${href}`);
          continue;
        }

        const jobId = hrefMatch[1];
        const url = `https://jobs.apple.com${href}`;

        // Extract location
        const locationElement = element.locator('.table--advanced-search__location-sub').first();
        const locationExists = await locationElement.count() > 0;
        const location = locationExists ? await locationElement.textContent({ timeout: 5000 }) : 'Munich, Germany';

        // Extract posting date
        const dateElement = element.locator('.job-posted-date').first();
        const dateExists = await dateElement.count() > 0;
        const dateText = dateExists ? await dateElement.textContent({ timeout: 5000 }) : null;
        const postedDate = dateText ? new Date(dateText).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        const job = {
          title: title.trim(),
          company: 'Apple',
          location: location?.trim() || 'Munich, Germany',
          url,
          description: '',
          postedDate
        };

        jobs.push(job);
        logger.info(`✅ Extracted: ${job.title} at ${job.company}`);

      } catch (error) {
        logger.warn('Error extracting job from Apple element:', error.message);
        // Continue to next element instead of failing completely
      }
    }

    logger.info(`📊 Found ${jobs.length} relevant jobs from Apple Careers`);

  } catch (error) {
    logger.error('❌ Error scraping Apple Careers:', error);
  } finally {
    await page.close();
  }

  return jobs;
}
