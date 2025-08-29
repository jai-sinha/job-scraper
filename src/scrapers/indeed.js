import { logger } from '../utils/logger.js';

const SEARCH_LOCATION = process.env.SEARCH_LOCATION || 'Munich';
const SEARCH_KEYWORDS = (process.env.SEARCH_KEYWORDS || 'software engineer').split(',');

export async function scrapeIndeed(browser) {
  const page = await browser.newPage();
  const jobs = [];
  
  try {
    logger.info('🔍 Scraping Indeed...');
    
    // Better Cloudflare avoidance
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });
    
    // Set viewport to common resolution
    await page.setViewportSize({ width: 1366, height: 768 });
    
    // Add some randomness to appear more human
    await page.addInitScript(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock some navigator properties
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });
    
    // Build search URL for Indeed
    const searchTerm = encodeURIComponent(SEARCH_KEYWORDS[0]);
    const location = encodeURIComponent(SEARCH_LOCATION);
    const searchUrl = `https://de.indeed.com/jobs?q=${searchTerm}&l=${location}&sort=date&fromage=7`; // Only jobs from last 7 days
    
    // Navigate with random delay
    await page.waitForTimeout(Math.random() * 2000 + 1000); // 1-3 second delay
    
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });
    
    // Random mouse movement to appear more human
    await page.mouse.move(Math.random() * 800, Math.random() * 600);
    
    // Handle cookie banner with more patience
    try {
      await page.waitForTimeout(3000); // Wait longer for page to load
      const cookieSelectors = [
        '#onetrust-accept-btn-handler',
        'button:has-text("Accept")',
        'button:has-text("Alle akzeptieren")',
        'button[id*="accept"]',
        'button[class*="accept"]'
      ];
      
      for (const selector of cookieSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 2000 })) {
            await button.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
    } catch (error) {
      // Ignore cookie banner errors
    }
    
    // Wait for job results
    try {
      await page.waitForSelector('.job_seen_beacon, [data-testid="job-card"], .jobsearch-SerpJobCard', { timeout: 10000 });
    } catch (error) {
      logger.warn('Could not find job results on Indeed');
      return jobs;
    }
    
    // Extract job listings
    const jobSelectors = [
      '.job_seen_beacon',
      '[data-testid="job-card"]',
      '.jobsearch-SerpJobCard'
    ];
    
    let jobElements = [];
    for (const selector of jobSelectors) {
      try {
        jobElements = await page.locator(selector).all();
        if (jobElements.length > 0) break;
      } catch (error) {
        continue;
      }
    }
    
    if (jobElements.length === 0) {
      logger.warn('No job listings found on Indeed');
      return jobs;
    }
    
    logger.info(`Found ${jobElements.length} job elements on Indeed`);
    
    for (let i = 0; i < Math.min(jobElements.length, 20); i++) {
      try {
        const element = jobElements[i];
        
        // Extract job title
        const titleSelectors = [
          'h2 a span[title]',
          'h2 a',
          '.jobTitle a span',
          '[data-testid="job-title"] a'
        ];
        
        let title = '';
        let jobUrl = '';
        for (const selector of titleSelectors) {
          try {
            const titleElement = element.locator(selector).first();
            if (await titleElement.isVisible({ timeout: 1000 })) {
              if (selector.includes('span[title]')) {
                title = await titleElement.getAttribute('title');
              } else {
                title = await titleElement.textContent();
              }
              
              // Get URL from parent link
              const linkElement = titleElement.locator('..').first();
              const href = await linkElement.getAttribute('href');
              if (href) {
                jobUrl = href.startsWith('http') ? href : `https://de.indeed.com${href}`;
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
          '[data-testid="company-name"]',
          '.companyName a',
          '.companyName span'
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
          '[data-testid="job-location"]',
          '.companyLocation'
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
        logger.warn('Error extracting job from Indeed element:', error.message);
      }
    }
    
    logger.info(`📊 Found ${jobs.length} relevant jobs from Indeed`);
    
  } catch (error) {
    logger.error('❌ Error scraping Indeed:', error);
  } finally {
    await page.close();
  }
  
  return jobs;
}
