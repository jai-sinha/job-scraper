import { chromium } from 'playwright';
import { saveJob, getJobByUrl } from '../database/db.js';
import { logger } from '../utils/logger.js';
import { scrapeGoogleCareers } from './google-careers.js';
import { scrapeBMW } from './bmw.js';
import { scrapeMicrosoft } from './microsoft.js';
import { scrapeApple } from './apple.js';
import { scrapeMicrosoft } from './microsoft.js';

export async function runScraping() {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  const startCpu = process.cpuUsage();
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const newJobs = [];
  
  try {
    logger.info('🔍 Starting job scraping...');
    logger.info(`📊 Initial memory: ${Math.round(startMemory.heapUsed / 1024 / 1024)}MB used`);
    logger.info(`⚡ Initial CPU: ${Math.round((startCpu.user + startCpu.system) / 1000)}ms total`);
    
        // Run both scrapers concurrently
    const [googleJobs, bmwJobs, microsoftJobs, appleJobs] = await Promise.all([
      (async () => {
        try {
          const jobs = await scrapeGoogleCareers(browser);
          const newJobs = await processJobs(jobs, 'Google Careers');
          return newJobs;
        } catch (error) {
          logger.error('❌ Error scraping Google Careers:', error);
          return [];
        }
      })(),
      (async () => {
        try {
          const jobs = await scrapeBMW(browser);
          const newJobs = await processJobs(jobs, 'BMW Careers');
          return newJobs;
        } catch (error) {
          logger.error('❌ Error scraping BMW Careers:', error);
          return [];
        }
      })(),
      (async () => {
        try {
          const jobs = await scrapeMicrosoft(browser);
          const newJobs = await processJobs(jobs, 'Microsoft Careers');
          return newJobs;
        } catch (error) {
          logger.error('❌ Error scraping Microsoft Careers:', error);
          return [];
        }
      })(),
      (async () => {
        try {
          const jobs = await scrapeApple(browser);
          const newJobs = await processJobs(jobs, 'Apple Careers');
          return newJobs;
        } catch (error) {
          logger.error('❌ Error scraping Apple Careers:', error);
          return [];
        }
      })()
    ]);

    // Combine results
    newJobs.push(...googleJobs, ...bmwJobs, ...microsoftJobs, ...appleJobs);
    
    
    logger.info(`✅ Scraping completed. Found ${newJobs.length} new jobs`);
    
    // Log performance metrics
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    logger.info(`⏱️  Total execution time: ${duration.toFixed(2)} seconds`);
    logger.info(`📊 Memory usage: ${Math.round(endMemory.heapUsed / 1024 / 1024)}MB used`);
    logger.info(`⚡ CPU usage: ${Math.round((endCpu.user + endCpu.system) / 1000)}ms total`);
    
  } finally {
    await browser.close();
  }
  
  return newJobs;
}

async function processJobs(jobs, source) {
  const newJobs = [];
  
  for (const job of jobs) {
    try {
      // Check if job already exists
      const existingJob = await getJobByUrl(job.url);
      
      if (!existingJob) {
        // Save new job
        const wasInserted = await saveJob({ ...job, source });
        
        if (wasInserted) {
          newJobs.push({ ...job, source });
          logger.info(`📝 New job saved: ${job.title} at ${job.company}`);
        }
      }
    } catch (error) {
      logger.error('❌ Error processing job:', error);
    }
  }
  
  return newJobs;
}
