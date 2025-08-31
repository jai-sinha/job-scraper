import { chromium } from 'playwright';
import { scrapeGlassdoor } from './src/scrapers/glassdoor.js';
import { logger } from './src/utils/logger.js';

async function quickTest() {
  const browser = await chromium.launch({ headless: false });
  
  try {
    const jobs = await scrapeGlassdoor(browser);
    
    logger.info(`📊 Total jobs found: ${jobs.length}`);
    
    jobs.slice(0, 3).forEach((job, index) => {
      logger.info(`\n${index + 1}. ${job.title}`);
      logger.info(`   Company: ${job.company}`);
      logger.info(`   Location: ${job.location}`);
    });
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

quickTest();
