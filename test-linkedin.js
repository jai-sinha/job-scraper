import { chromium } from 'playwright';
import { scrapeLinkedIn } from './src/scrapers/linkedin.js';
import { logger } from './src/utils/logger.js';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function testLinkedIn() {
  try {
    logger.info('🧪 Testing LinkedIn scraper...');
    
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const jobs = await scrapeLinkedIn(browser);
    
    await browser.close();
    
    // Save results to JSON
    const results = {
      timestamp: new Date().toISOString(),
      source: 'LinkedIn',
      totalJobs: jobs.length,
      jobs: jobs
    };
    
    await fs.writeFile('./test-linkedin-results.json', JSON.stringify(results, null, 2));
    
    logger.info(`✅ Found ${jobs.length} jobs from LinkedIn`);
    logger.info('📄 Results saved to test-linkedin-results.json');
    
    if (jobs.length > 0) {
      logger.info('📋 Sample jobs:');
      jobs.slice(0, 5).forEach((job, index) => {
        logger.info(`  ${index + 1}. "${job.title}" at ${job.company}`);
        logger.info(`     Location: ${job.location}`);
        logger.info(`     URL: ${job.url}`);
        logger.info('');
      });
    }
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
}

testLinkedIn();
