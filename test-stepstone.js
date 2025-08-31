import { chromium } from 'playwright';
import { scrapeStepStone } from './src/scrapers/stepstone.js';
import { logger } from './src/utils/logger.js';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function testStepStone() {
  try {
    logger.info('🧪 Testing StepStone scraper...');
    
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const jobs = await scrapeStepStone(browser);
    
    await browser.close();
    
    // Save results to JSON
    const results = {
      timestamp: new Date().toISOString(),
      source: 'StepStone',
      totalJobs: jobs.length,
      jobs: jobs
    };
    
    await fs.writeFile('./test-stepstone-results.json', JSON.stringify(results, null, 2));
    
    logger.info(`✅ Found ${jobs.length} jobs from StepStone`);
    logger.info('📄 Results saved to test-stepstone-results.json');
    
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

testStepStone();
