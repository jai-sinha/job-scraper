import { initializeDatabase, getJobStats } from './src/database/db.js';
import { runScraping } from './src/scrapers/index.js';
import { logger } from './src/utils/logger.js';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testScraper() {
  try {
    logger.info('🧪 Starting scraper test...');
    
    // Initialize database
    await initializeDatabase();
    
    // Run scraping
    const newJobs = await runScraping();
    
    // Show results
    logger.info(`✅ Test completed! Found ${newJobs.length} new jobs`);
    
    // Save results to JSON for easier viewing
    const results = {
      timestamp: new Date().toISOString(),
      totalNewJobs: newJobs.length,
      jobsBySource: {},
      jobs: newJobs.map(job => ({
        title: job.title,
        company: job.company,
        location: job.location,
        source: job.source,
        url: job.url,
        postedDate: job.postedDate
      }))
    };
    
    // Group by source
    newJobs.forEach(job => {
      if (!results.jobsBySource[job.source]) {
        results.jobsBySource[job.source] = 0;
      }
      results.jobsBySource[job.source]++;
    });
    
    // Save to JSON file
    await fs.writeFile('./test-results.json', JSON.stringify(results, null, 2));
    logger.info('📄 Results saved to test-results.json');
    
    if (newJobs.length > 0) {
      logger.info('📋 Jobs found:');
      newJobs.forEach((job, index) => {
        logger.info(`  ${index + 1}. ${job.title} at ${job.company} (${job.source})`);
        logger.info(`     Location: ${job.location}`);
        logger.info(`     URL: ${job.url}`);
        logger.info('');
      });
    }
    
    // Show database stats
    const stats = await getJobStats();
    logger.info(`📊 Database stats: ${stats.total} total jobs, ${stats.pending} pending notifications`);
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
}

testScraper();
