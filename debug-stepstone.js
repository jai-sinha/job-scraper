import { chromium } from 'playwright';
import { logger } from './src/utils/logger.js';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function debugStepStone() {
  try {
    logger.info('🧪 Debugging StepStone scraper...');
    
    const browser = await chromium.launch({ 
      headless: false, // Let's see what happens
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en'] });
    });

    const page = await context.newPage();

    // Try different URL formats for StepStone
    const urls = [
      'https://www.stepstone.de/stellenangebote--Software-Engineer-Muenchen',
      'https://www.stepstone.de/jobs/software-engineer/muenchen',
      'https://www.stepstone.de/jobs?q=software+engineer&l=M%C3%BCnchen'
    ];
    
    for (const url of urls) {
      try {
        logger.info(`Trying URL: ${url}`);
        
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(3000);

        // Check for cookie banner
        try {
          const cookieAccept = page.locator('button:has-text("Alle akzeptieren"), button:has-text("Accept"), [data-testid*="accept"]').first();
          if (await cookieAccept.isVisible({ timeout: 2000 })) {
            await cookieAccept.click();
            logger.info('✅ Accepted cookies');
            await page.waitForTimeout(2000);
          }
        } catch (error) {
          // Ignore cookie errors
        }

        // Try to find job listings
        const selectors = ['[data-testid="job-item"]', '.job-item', '.listing-item', '.job-element'];
        let foundJobs = false;
        
        for (const selector of selectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 });
            const jobElements = await page.$$(selector);
            logger.info(`✅ Found ${jobElements.length} jobs with selector: ${selector}`);
            foundJobs = true;
            break;
          } catch (error) {
            logger.warn(`Selector ${selector} not found`);
          }
        }
        
        if (foundJobs) {
          logger.info(`✅ Successfully loaded StepStone with URL: ${url}`);
          break;
        } else {
          // Save HTML for debugging
          const html = await page.content();
          await fs.writeFile(`./debug-stepstone-${urls.indexOf(url)}.html`, html);
          logger.info(`💾 Saved page HTML to debug-stepstone-${urls.indexOf(url)}.html`);
        }
        
      } catch (error) {
        logger.error(`❌ Failed with URL ${url}:`, error.message);
      }
    }

    await browser.close();
    
  } catch (error) {
    logger.error('❌ Debug failed:', error);
  }
}

debugStepStone();
