import { logger } from '../utils/logger.js';

const SEARCH_LOCATION = process.env.SEARCH_LOCATION || 'Munich';
const SEARCH_KEYWORDS = (process.env.SEARCH_KEYWORDS || 'software engineer').split(',');

export async function scrapeGlassdoor(browser) {
  const page = await browser.newPage();
  const jobs = [];
  
  try {
    logger.info('🔍 Scraping Glassdoor...');
    
    // Better stealth techniques
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none'
    });
    
    // Set viewport to common resolution
    await page.setViewportSize({ width: 1366, height: 768 });
    
    // Override webdriver detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Override the plugins property to use a fake value
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override the languages property to use a fake value
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });
    
    // Build search URL for Glassdoor (use the URL format that worked in debug)
    const searchTerm = encodeURIComponent('software engineer');
    const location = encodeURIComponent('Munich');
    const searchUrl = `https://www.glassdoor.com/Job/jobs.htm?suggestCount=0&suggestChosen=false&clickSource=searchBtn&typedKeyword=${searchTerm}&sc.keyword=${searchTerm}&locT=C&locId=2867714&jobType=`;
    
    // Add random delay to appear more human
    await page.waitForTimeout(Math.random() * 2000 + 1000);
    
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });
    
        // Handle potential cookie/privacy banners with more patience
    try {
      await page.waitForTimeout(4000); // Wait longer for page to load
      const cookieSelectors = [
        '#onetrust-accept-btn-handler',
        'button:has-text("Accept")',
        'button:has-text("OK")',
        'button[data-test="gdpr-accept"]',
        'button[class*="accept"]',
        'button[id*="accept"]'
      ];
      
      for (const selector of cookieSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 3000 })) {
            await button.click();
            await page.waitForTimeout(2000);
            logger.info('✅ Accepted cookies');
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
    } catch (error) {
      // Ignore cookie banner errors
    }
    
    // Wait for job listings to load with more specific selectors
    const jobSelectors = [
      '[data-test="jobListing"]',
      '.JobsList_jobListItem__wjTHv'
    ];
    
    let foundSelector = null;
    for (const selector of jobSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 8000 });
        foundSelector = selector;
        logger.info(`Found job listings using selector: ${selector}`);
        break;
      } catch (error) {
        logger.warn(`Selector ${selector} not found, trying next...`);
      }
    }
    
    if (!foundSelector) {
      logger.warn('Could not find job listings on Glassdoor');
      return jobs;
    }
    
    // Extract job listings using the working selectors
    let jobElements = [];
    for (const selector of jobSelectors) {
      try {
        jobElements = await page.locator(selector).all();
        if (jobElements.length > 0) {
          logger.info(`Found ${jobElements.length} job elements using ${selector}`);
          break;
        }
      } catch (error) {
        // Continue
      }
    }
    
    if (jobElements.length === 0) {
      logger.warn('No job listings found on Glassdoor');
      return jobs;
    }
    
    for (let i = 0; i < Math.min(jobElements.length, 15); i++) {
      try {
        const element = jobElements[i];
        
        // Extract job title
        const titleSelectors = [
          '[data-test="job-title"] a',
          '[data-test="job-title"]',
          '.JobCard_jobTitle__rbjTE a',
          '.jobLink',
          'h3 a',
          'a[data-test="job-title"]'
        ];
        
        let title = '';
        let jobUrl = '';
        for (const selector of titleSelectors) {
          try {
            const titleElement = element.locator(selector).first();
            if (await titleElement.isVisible({ timeout: 1000 })) {
              title = await titleElement.textContent();
              // Also try to get the URL from the same element
              const href = await titleElement.getAttribute('href');
              if (href) {
                jobUrl = href.startsWith('http') ? href : `https://www.glassdoor.com${href}`;
              }
              if (title && title.trim()) {
                title = title.trim();
                break;
              }
            }
          } catch (error) {
            // Continue to next selector
          }
        }
        
        if (!title) continue;
        
        // Check if title contains relevant keywords
        const titleLower = title.toLowerCase();
        const hasRelevantKeyword = SEARCH_KEYWORDS.some(keyword => 
          titleLower.includes(keyword.toLowerCase())
        ) || titleLower.includes('developer') || titleLower.includes('engineer') || titleLower.includes('software');
        
        if (!hasRelevantKeyword) continue;
        
        // Extract company name with better filtering
        const companySelectors = [
          '[data-test="employer-name"]',
          '[data-test="employer-name"] a',
          '.JobCard_companyName__hCYZL',
          '.companyName',
          'span[title]',
          'a[data-test="employer-name"]',
          // Additional selectors to try
          'div[data-test="employer-name"]',
          '.EmployerProfile_compactEmployerName__LE242',
          'span[data-test="employer-name"]'
        ];
        
        let company = '';
        for (const selector of companySelectors) {
          try {
            const companyElement = element.locator(selector).first();
            if (await companyElement.isVisible({ timeout: 1000 })) {
              const companyText = await companyElement.textContent();
              if (companyText && companyText.trim() && companyText.trim() !== 'Unknown Company') {
                // Filter out skill-related text
                const text = companyText.trim();
                if (!text.toLowerCase().includes('skills:') && 
                    !text.toLowerCase().includes('css') && 
                    !text.toLowerCase().includes('javascript') &&
                    !text.toLowerCase().includes('php') &&
                    !text.toLowerCase().includes('java') &&
                    !text.toLowerCase().includes('python') &&
                    !text.toLowerCase().includes('c++') &&
                    text.length < 100) { // Company names should be reasonable length
                  company = text;
                  break;
                }
              }
              
              // Also try getting title attribute if text is empty or filtered out
              const titleAttr = await companyElement.getAttribute('title');
              if (titleAttr && titleAttr.trim() && !company) {
                const text = titleAttr.trim();
                if (!text.toLowerCase().includes('skills:') && text.length < 100) {
                  company = text;
                  break;
                }
              }
            }
          } catch (error) {
            // Continue
          }
        }
        
        // If still no company, try to extract from the job element's text content with better filtering
        if (!company) {
          try {
            const elementText = await element.textContent();
            if (elementText) {
              const lines = elementText.split('\n').map(line => line.trim()).filter(line => line);
              // Look for lines that might be company names (usually shorter, after the job title)
              for (let i = 1; i < Math.min(lines.length, 8); i++) {
                const line = lines[i];
                if (line && 
                    line.length > 2 && 
                    line.length < 60 && 
                    !line.toLowerCase().includes('day') &&
                    !line.toLowerCase().includes('ago') &&
                    !line.toLowerCase().includes('hour') &&
                    !line.toLowerCase().includes('€') &&
                    !line.toLowerCase().includes('$') &&
                    !line.toLowerCase().includes('salary') &&
                    !line.toLowerCase().includes('skills:') &&
                    !line.toLowerCase().includes('javascript') &&
                    !line.toLowerCase().includes('python') &&
                    !line.toLowerCase().includes('java') &&
                    !line.toLowerCase().includes('php') &&
                    !line.toLowerCase().includes('css') &&
                    !line.toLowerCase().includes('html') &&
                    !line.toLowerCase().includes('sql') &&
                    !line.toLowerCase().includes('c++') &&
                    !line.toLowerCase().includes('git') &&
                    !line.toLowerCase().includes('mvc')) {
                  company = line;
                  break;
                }
              }
            }
          } catch (error) {
            // Continue
          }
        }
        
        if (!company) company = 'Unknown Company';
        
        // Extract location
        const locationSelectors = [
          '[data-test="job-location"]',
          '.JobCard_location__N_iYE',
          '.locationsContainer',
          'span[data-test="job-location"]'
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
            // Continue
          }
        }
        
        // If we didn't get URL from title element, try other ways
        if (!jobUrl) {
          const linkSelectors = [
            'a[href*="/job-listing/"]',
            'a[href*="/jobs/"]',
            'a'
          ];
          
          for (const selector of linkSelectors) {
            try {
              const linkElement = element.locator(selector).first();
              if (await linkElement.isVisible({ timeout: 1000 })) {
                const href = await linkElement.getAttribute('href');
                if (href && (href.includes('job-listing') || href.includes('jobs'))) {
                  jobUrl = href.startsWith('http') ? href : `https://www.glassdoor.com${href}`;
                  break;
                }
              }
            } catch (error) {
              // Continue
            }
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
        logger.warn('Error extracting job from Glassdoor element:', error.message);
      }
    }
    
    logger.info(`📊 Found ${jobs.length} relevant jobs from Glassdoor`);
    
  } catch (error) {
    logger.error('❌ Error scraping Glassdoor:', error);
  } finally {
    await page.close();
  }
  
  return jobs;
}
