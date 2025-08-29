import { logger } from '../utils/logger.js';

const SEARCH_LOCATION = process.env.SEARCH_LOCATION || 'Munich';
const SEARCH_KEYWORDS = (process.env.SEARCH_KEYWORDS || 'software engineer').split(',');

export async function scrapeGoogleCareers(browser) {
  const page = await browser.newPage();
  const jobs = [];
  
  try {
    logger.info('🔍 Scraping Google Careers...');
    
    // Use the exact URL format that works
    const searchUrl = 'https://www.google.com/about/careers/applications/jobs/results?location=Munich%2C%20Germany&q=%22Software%20Engineer%22&target_level=EARLY';
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle',
      timeout: 20000 
    });
    
    // Wait for job results to load
    await page.waitForSelector('li.lLd3Je', { timeout: 10000 });
    
    // Extract job listings using the exact structure we found
    const jobElements = await page.locator('li.lLd3Je').all();
    
    logger.info(`Found ${jobElements.length} job elements on Google Careers`);
    
    for (let i = 0; i < jobElements.length; i++) {
      try {
        const element = jobElements[i];
        
        // Extract job title
        const titleElement = element.locator('h3.QJPWVe').first();
        const title = await titleElement.textContent();
        
        if (!title || !title.trim()) continue;
        
        // Extract job URL from the "Learn more" link
        const linkElement = element.locator('a.WpHeLc').first();
        const relativeUrl = await linkElement.getAttribute('href');
        const url = relativeUrl ? `https://www.google.com/about/careers/applications/${relativeUrl}` : '';
        
        if (!url) continue;
        
        // Extract location
        const locationElement = element.locator('span.r0wTof').first();
        const location = await locationElement.textContent();
        
        // Company is always Google for this site
        const company = 'Google';
        
        const job = {
          title: title.trim(),
          company: company,
          location: location?.trim() || SEARCH_LOCATION,
          url,
          description: '', // Can be filled later if needed
          postedDate: new Date().toISOString().split('T')[0]
        };
        
        jobs.push(job);
        
        logger.info(`✅ Extracted: ${job.title} at ${job.company}`);
        
      } catch (error) {
        logger.warn('Error extracting job from Google element:', error.message);
      }
    }
    
    logger.info(`📊 Found ${jobs.length} relevant jobs from Google Careers`);
    
  } catch (error) {
    logger.error('❌ Error scraping Google Careers:', error);
  } finally {
    await page.close();
  }
  
  return jobs;
}
