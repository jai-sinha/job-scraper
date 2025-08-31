import { chromium } from 'playwright';
import { logger } from './src/utils/logger.js';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function debugLinkedIn() {
  try {
    logger.info('🧪 Debugging LinkedIn scraper...');
    
    const browser = await chromium.launch({ 
      headless: false, // Let's see what happens
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    const page = await context.newPage();

    const url = 'https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer&location=Munich%2C%20Bavaria%2C%20Germany&geoId=106967730&f_E=1,2&sortBy=DD';
    logger.info(`Navigating to: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Check if we need to sign in
    const signInRequired = await page.$('.nav__button-secondary');
    if (signInRequired) {
      logger.warn('LinkedIn requires sign-in, trying guest access...');
    }

    // Try to find job listings
    const selectors = ['.job-search-card', '.jobs-search__results-list li', '.base-card'];
    let jobElements = [];
    
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        jobElements = await page.$$(selector);
        logger.info(`Found LinkedIn job listings using selector: ${selector}`);
        logger.info(`Found ${jobElements.length} job elements on LinkedIn`);
        break;
      } catch (error) {
        logger.warn(`Selector ${selector} not found, trying next...`);
      }
    }

    if (jobElements.length === 0) {
      // Let's save the page HTML to see what's actually there
      const html = await page.content();
      await fs.writeFile('./debug-linkedin.html', html);
      logger.info('💾 Saved page HTML to debug-linkedin.html');
    } else {
      // Let's extract a few sample jobs to see what we're getting
      const sampleJobs = [];
      
      for (let i = 0; i < Math.min(5, jobElements.length); i++) {
        try {
          const element = jobElements[i];
          
          const titleElement = await element.$('a h3, .sr-only, .base-search-card__title, .job-search-card__title');
          const title = titleElement ? (await titleElement.textContent())?.trim() : 'No title found';
          
          const companyElement = await element.$('.base-search-card__subtitle, .job-search-card__subtitle-link, a[data-tracking-control-name="public_jobs_jserp-result_job-search-card-subtitle"]');
          const company = companyElement ? (await companyElement.textContent())?.trim() : 'No company found';
          
          const locationElement = await element.$('.job-search-card__location, .base-search-card__metadata');
          const location = locationElement ? (await locationElement.textContent())?.trim() : 'No location found';
          
          const linkElement = await element.$('a');
          const url = linkElement ? await linkElement.getAttribute('href') : 'No URL found';
          
          sampleJobs.push({ title, company, location, url });
          
        } catch (error) {
          logger.warn(`Error extracting job ${i}:`, error.message);
        }
      }
      
      logger.info('📋 Sample extracted jobs:');
      sampleJobs.forEach((job, index) => {
        logger.info(`  ${index + 1}. "${job.title}" at ${job.company}`);
        logger.info(`     Location: ${job.location}`);
        logger.info(`     URL: ${job.url}`);
        logger.info('');
      });
      
      await fs.writeFile('./debug-linkedin-jobs.json', JSON.stringify(sampleJobs, null, 2));
    }

    await browser.close();
    
  } catch (error) {
    logger.error('❌ Debug failed:', error);
  }
}

debugLinkedIn();
