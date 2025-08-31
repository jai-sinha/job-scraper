import { chromium } from 'playwright';
import { logger } from './src/utils/logger.js';
import { promises as fs } from 'fs';

async function debugStepStone() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    logger.info('🔍 Debugging StepStone company extraction...');
    
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    });
    
    const searchUrl = 'https://www.stepstone.de/jobs/computer-science/in-münchen';
    
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    // Handle cookies
    try {
      await page.waitForTimeout(2000);
      const acceptButton = page.locator('button:has-text("Alle akzeptieren")').first();
      if (await acceptButton.isVisible({ timeout: 2000 })) {
        await acceptButton.click();
        await page.waitForTimeout(1000);
      }
    } catch (error) {
      // Ignore
    }
    
    // Wait for job listings
    await page.waitForSelector('[data-testid="job-item"]', { timeout: 5000 });
    
    const jobElements = await page.locator('[data-testid="job-item"]').all();
    logger.info(`Found ${jobElements.length} job elements`);
    
    // Inspect first 3 job elements
    for (let i = 0; i < Math.min(3, jobElements.length); i++) {
      logger.info(`\n=== JOB ELEMENT ${i + 1} ===`);
      
      const element = jobElements[i];
      const html = await element.innerHTML();
      
      // Save HTML for inspection
      await fs.writeFile(`./debug-stepstone-job-${i + 1}.html`, html);
      
      // Try various company selectors
      const companySelectors = [
        '[data-testid="company-name"]',
        '.listing-company',
        '.company-name',
        'span[title]',
        '[data-testid*="company"]',
        '.company',
        'a[href*="unternehmen"]',
        'span:has-text("GmbH")',
        'span:has-text("AG")',
        'span:has-text("Inc")',
        'div:has-text("GmbH")',
        'div:has-text("AG")',
        'h4',
        'h5',
        'p'
      ];
      
      for (const selector of companySelectors) {
        try {
          const companyElements = element.locator(selector);
          const count = await companyElements.count();
          
          if (count > 0) {
            for (let j = 0; j < Math.min(3, count); j++) {
              const text = await companyElements.nth(j).textContent();
              if (text && text.trim()) {
                logger.info(`  ${selector} [${j}]: "${text.trim()}"`);
              }
            }
          }
        } catch (error) {
          // Ignore selector errors
        }
      }
    }
    
    // Save full page HTML
    const fullHtml = await page.content();
    await fs.writeFile('./debug-stepstone-full.html', fullHtml);
    logger.info('HTML saved for inspection');
    
    await page.waitForTimeout(3000);
    
  } catch (error) {
    logger.error('❌ Debug error:', error);
  } finally {
    await browser.close();
  }
}

debugStepStone();
