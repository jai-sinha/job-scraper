import { chromium } from 'playwright';
import { scrapeGoogleCareers } from './src/scrapers/google-careers.js';
import { logger } from './src/utils/logger.js';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function testGoogleCareers() {
  try {
    logger.info('🧪 Testing Google Careers scraper...');
    
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const jobs = await scrapeGoogleCareers(browser);
    
    await browser.close();
    
    // Save results to JSON
    const results = {
      timestamp: new Date().toISOString(),
      source: 'Google Careers',
      totalJobs: jobs.length,
      jobs: jobs
    };
    
    await fs.writeFile('./test-google-results.json', JSON.stringify(results, null, 2));
    
    logger.info(`✅ Found ${jobs.length} jobs from Google Careers`);
    logger.info('📄 Results saved to test-google-results.json');
    
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

testGoogleCareers();
