import { logger } from '../utils/logger.js';

const SEARCH_LOCATION = process.env.SEARCH_LOCATION || 'Munich';
const SEARCH_KEYWORDS = (process.env.SEARCH_KEYWORDS || 'software engineer').split(',');

export async function scrapeLinkedIn(browser) {
  const page = await browser.newPage();
  const jobs = [];
  
  try {
    logger.info('🔍 Scraping LinkedIn...');
    
    // Enhanced stealth for LinkedIn
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none'
    });
    
    await page.setViewportSize({ width: 1366, height: 768 });
    
    // Override webdriver detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });
    
    // Build LinkedIn Jobs URL - using working URL format
    const searchTerm = encodeURIComponent(SEARCH_KEYWORDS[0]);
    // Use Munich geo ID and entry level filter
    const searchUrl = `https://www.linkedin.com/jobs/search/?distance=25&f_E=2&f_WT=1%2C3&geoId=100477049&keywords=${searchTerm}&origin=JOBS_HOME_KEYWORD_HISTORY&refresh=true`;
    
    // Random delay before navigation
    await page.waitForTimeout(Math.random() * 1000 + 500);
    
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 5000 
    });
    
    // Wait for job results to load
    await page.waitForTimeout(2000);
    
    // Check for sign-in requirement
    if (await page.locator('text=/sign in/i').count() > 0) {
      logger.warn('LinkedIn requires sign-in, trying guest access...');
      // LinkedIn often allows viewing some jobs without signing in
    }
    
    // Wait for job listings
    const jobSelectors = [
      '.job-card-container',
      '.job-card-list__entity-lockup',
      '.job-search-card',
      '.jobs-search__results-list li',
      '[data-entity-urn*="job"]',
      '.job-result-card'
    ];
    
    let foundSelector = null;
    for (const selector of jobSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        foundSelector = selector;
        logger.info(`Found LinkedIn job listings using selector: ${selector}`);
        break;
      } catch (error) {
        logger.warn(`Selector ${selector} not found, trying next...`);
      }
    }
    
    if (!foundSelector) {
      logger.warn('Could not find job listings on LinkedIn');
      return jobs;
    }
    
    // Extract job listings
    let jobElements = [];
    for (const selector of jobSelectors) {
      try {
        jobElements = await page.locator(selector).all();
        if (jobElements.length > 0) {
          logger.info(`Found ${jobElements.length} job elements on LinkedIn`);
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (jobElements.length === 0) {
      logger.warn('No job listings found on LinkedIn');
      return jobs;
    }
    
    // Process job elements
    for (let i = 0; i < Math.min(jobElements.length, 20); i++) {
      try {
        const element = jobElements[i];
        
        // Extract job title
        const titleSelectors = [
          '.job-card-container__link',
          '.job-card-list__title--link',
          'h3 a',
          '.job-search-card__title a',
          'h4 a',
          '[data-entity-urn*="job"] h3'
        ];
        
        let title = '';
        let jobUrl = '';
        for (const selector of titleSelectors) {
          try {
            const titleElement = element.locator(selector).first();
            if (await titleElement.isVisible({ timeout: 1000 })) {
              title = await titleElement.textContent();
              const href = await titleElement.getAttribute('href');
              if (href) {
                jobUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
              }
              if (title && title.trim()) {
                title = title.trim();
                break;
              }
            }
          } catch (error) {
            continue;
          }
        }
        
        if (!title) continue;
        
        // Check if title contains relevant keywords
        const titleLower = title.toLowerCase();
        const hasRelevantKeyword = SEARCH_KEYWORDS.some(keyword => 
          titleLower.includes(keyword.toLowerCase())
        ) || titleLower.includes('developer') || titleLower.includes('engineer') || titleLower.includes('software');
        
        if (!hasRelevantKeyword) continue;
        
        // Extract company name
        const companySelectors = [
          '.artdeco-entity-lockup__subtitle',
          '.job-search-card__subtitle a',
          'h4 a',
          '.job-result-card__subtitle',
          'a[data-tracking-control-name="public_jobs_jserp-result_job-search-card-subtitle"]'
        ];
        
        let company = '';
        for (const selector of companySelectors) {
          try {
            const companyElement = element.locator(selector).first();
            if (await companyElement.isVisible({ timeout: 1000 })) {
              company = await companyElement.textContent();
              if (company && company.trim()) {
                company = company.trim();
                break;
              }
            }
          } catch (error) {
            continue;
          }
        }
        
        if (!company) company = 'Unknown Company';
        
        // Extract location
        const locationSelectors = [
          '.artdeco-entity-lockup__caption li span',
          '.job-search-card__location',
          '.job-result-card__location'
        ];
        
        let location = '';
        for (const selector of locationSelectors) {
          try {
            const locationElement = element.locator(selector).first();
            if (await locationElement.isVisible({ timeout: 1000 })) {
              location = await locationElement.textContent();
              if (location && location.trim()) {
                location = location.trim();
                break;
              }
            }
          } catch (error) {
            continue;
          }
        }
        
        if (!jobUrl) continue;
        
        // Filter by location - must contain Munich or München
        const locationLower = location.toLowerCase();
        const isMunichJob = locationLower.includes('munich') || 
                           locationLower.includes('münchen') || 
                           locationLower.includes('bavaria') ||
                           locationLower.includes('bayern');
        
        if (!isMunichJob) {
          logger.debug(`Skipping job in ${location} - not in Munich area`);
          continue;
        }
        
        const job = {
          title: title,
          company: company,
          location: location || SEARCH_LOCATION,
          url: jobUrl,
          description: '',
          postedDate: new Date().toISOString().split('T')[0]
        };
        
        jobs.push(job);
        
      } catch (error) {
        logger.warn('Error extracting job from LinkedIn element:', error.message);
      }
    }
    
    logger.info(`📊 Found ${jobs.length} relevant jobs from LinkedIn`);
    
  } catch (error) {
    logger.error('❌ Error scraping LinkedIn:', error);
  } finally {
    await page.close();
  }
  
  return jobs;
}
