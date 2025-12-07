import time
import json
import random
from typing import Dict, List, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from bs4 import BeautifulSoup
import undetected_chromedriver as uc
from fake_useragent import UserAgent
import pandas as pd
from datetime import datetime
import re

class JobScraper:
    def __init__(self):
        self.ua = UserAgent()
        self.job_platforms = {
            'careers24': {
                'url': 'https://www.careers24.com',
                'search_pattern': '/jobs/',
                'login_required': False
            },
            'pnet': {
                'url': 'https://www.pnet.co.za',
                'search_pattern': '/stellenangebote/',
                'login_required': False
            },
            'careerjunction': {
                'url': 'https://www.careerjunction.co.za',
                'search_pattern': '/jobs/',
                'login_required': True
            },
            'indeed': {
                'url': 'https://za.indeed.com',
                'search_pattern': '/jobs',
                'login_required': False
            },
            'linkedin': {
                'url': 'https://www.linkedin.com/jobs',
                'search_pattern': '/jobs/view/',
                'login_required': True
            }
        }
        
    def setup_driver(self):
        """Setup undetectable Chrome driver"""
        options = uc.ChromeOptions()
        options.add_argument(f'user-agent={self.ua.random}')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        driver = uc.Chrome(options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        return driver
    
    def search_jobs(self, keywords: List[str], location: str = 'South Africa', max_pages: int = 5) -> List[Dict]:
        """Search for jobs across multiple platforms"""
        all_jobs = []
        
        for platform_name, platform_info in self.job_platforms.items():
            try:
                print(f"Searching {platform_name}...")
                jobs = self._search_platform(
                    platform_name,
                    platform_info,
                    keywords,
                    location,
                    max_pages
                )
                all_jobs.extend(jobs)
                print(f"Found {len(jobs)} jobs on {platform_name}")
                
                # Avoid rate limiting
                time.sleep(random.uniform(2, 5))
                
            except Exception as e:
                print(f"Error searching {platform_name}: {str(e)}")
                continue
        
        # Remove duplicates
        unique_jobs = self._remove_duplicates(all_jobs)
        
        return unique_jobs
    
    def _search_platform(self, platform: str, platform_info: Dict, keywords: List[str], location: str, max_pages: int) -> List[Dict]:
        """Search specific platform"""
        driver = self.setup_driver()
        jobs = []
        
        try:
            driver.get(platform_info['url'])
            time.sleep(random.uniform(3, 5))
            
            # Platform-specific search logic
            if platform == 'careers24':
                jobs = self._search_careers24(driver, keywords, location, max_pages)
            elif platform == 'pnet':
                jobs = self._search_pnet(driver, keywords, location, max_pages)
            elif platform == 'indeed':
                jobs = self._search_indeed(driver, keywords, location, max_pages)
            # Add other platforms...
            
        finally:
            driver.quit()
        
        return jobs
    
    def _search_careers24(self, driver, keywords: List[str], location: str, max_pages: int) -> List[Dict]:
        """Search Careers24"""
        jobs = []
        
        try:
            # Navigate to search page
            search_url = f"{self.job_platforms['careers24']['url']}/jobs/"
            driver.get(search_url)
            
            # Fill search form
            search_box = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.NAME, "Keywords"))
            )
            search_box.clear()
            search_box.send_keys(' '.join(keywords))
            
            location_box = driver.find_element(By.NAME, "Location")
            location_box.clear()
            location_box.send_keys(location)
            
            # Submit search
            search_box.send_keys(Keys.RETURN)
            time.sleep(random.uniform(3, 5))
            
            # Parse results
            for page in range(max_pages):
                soup = BeautifulSoup(driver.page_source, 'html.parser')
                job_cards = soup.find_all('div', class_=re.compile(r'job-card', re.I))
                
                for card in job_cards:
                    job = self._parse_careers24_job(card)
                    if job:
                        jobs.append(job)
                
                # Try to go to next page
                try:
                    next_button = driver.find_element(By.CSS_SELECTOR, 'a[rel="next"]')
                    if 'disabled' in next_button.get_attribute('class', ''):
                        break
                    next_button.click()
                    time.sleep(random.uniform(2, 4))
                except:
                    break
                    
        except Exception as e:
            print(f"Error searching Careers24: {str(e)}")
        
        return jobs
    
    def _parse_careers24_job(self, card) -> Optional[Dict]:
        """Parse individual job card from Careers24"""
        try:
            title_elem = card.find('h3', class_=re.compile(r'title', re.I))
            company_elem = card.find('span', class_=re.compile(r'company', re.I))
            location_elem = card.find('span', class_=re.compile(r'location', re.I))
            link_elem = card.find('a', href=True)
            
            if not all([title_elem, link_elem]):
                return None
            
            job_id = re.search(r'/jobs/(\d+)', link_elem['href'])
            
            return {
                'platform': 'careers24',
                'job_id': job_id.group(1) if job_id else link_elem['href'],
                'title': title_elem.text.strip(),
                'company': company_elem.text.strip() if company_elem else 'Not specified',
                'location': location_elem.text.strip() if location_elem else 'South Africa',
                'url': f"{self.job_platforms['careers24']['url']}{link_elem['href']}",
                'date_posted': datetime.now().strftime('%Y-%m-%d'),
                'source': 'careers24'
            }
            
        except:
            return None
    
    def auto_apply(self, job: Dict, applicant_data: Dict, cv_path: str, cover_letter_path: str) -> Dict:
        """Automatically apply for a job"""
        driver = self.setup_driver()
        
        try:
            # Navigate to job page
            driver.get(job['url'])
            time.sleep(random.uniform(3, 5))
            
            # Check if easy apply is available
            apply_result = self._attempt_easy_apply(driver, applicant_data, cv_path, cover_letter_path)
            
            if not apply_result['success']:
                # Fallback to manual application detection
                apply_result = self._attempt_manual_apply(driver, job, applicant_data, cv_path, cover_letter_path)
            
            return {
                'job_id': job['job_id'],
                'platform': job['platform'],
                'applied_at': datetime.now().isoformat(),
                'success': apply_result['success'],
                'method': apply_result.get('method', 'unknown'),
                'message': apply_result.get('message', ''),
                'screenshot': apply_result.get('screenshot', '')
            }
            
        except Exception as e:
            return {
                'job_id': job['job_id'],
                'success': False,
                'error': str(e),
                'applied_at': datetime.now().isoformat()
            }
        finally:
            driver.quit()
    
    def _attempt_easy_apply(self, driver, applicant_data: Dict, cv_path: str, cover_letter_path: str) -> Dict:
        """Attempt Easy Apply functionality"""
        try:
            # Look for Easy Apply button (platform-specific selectors)
            easy_apply_selectors = [
                'button[aria-label*="Easy Apply"]',
                'button:contains("Easy Apply")',
                'button[data-test*="easy-apply"]',
                'button[class*="easy-apply"]',
                'a[href*="easy-apply"]'
            ]
            
            for selector in easy_apply_selectors:
                try:
                    easy_apply_btn = WebDriverWait(driver, 5).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                    )
                    easy_apply_btn.click()
                    time.sleep(random.uniform(2, 3))
                    
                    # Fill easy apply form
                    return self._fill_easy_apply_form(driver, applicant_data, cv_path, cover_letter_path)
                    
                except TimeoutException:
                    continue
            
            return {'success': False, 'message': 'Easy Apply not found'}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _fill_easy_apply_form(self, driver, applicant_data: Dict, cv_path: str, cover_letter_path: str) -> Dict:
        """Fill Easy Apply form"""
        try:
            # Fill contact information
            contact_fields = {
                'firstName': applicant_data['personalInfo']['firstName'],
                'lastName': applicant_data['personalInfo']['lastName'],
                'email': applicant_data['personalInfo']['email'],
                'phone': applicant_data['personalInfo']['phone']
            }
            
            for field_name, field_value in contact_fields.items():
                selectors = [
                    f'input[name*="{field_name}"]',
                    f'input[id*="{field_name}"]',
                    f'input[aria-label*="{field_name}"]'
                ]
                
                for selector in selectors:
                    try:
                        field = driver.find_element(By.CSS_SELECTOR, selector)
                        field.clear()
                        field.send_keys(field_value)
                        time.sleep(0.5)
                        break
                    except:
                        continue
            
            # Upload CV
            try:
                cv_input = driver.find_element(By.CSS_SELECTOR, 'input[type="file"][accept*="pdf"], input[type="file"][accept*="doc"]')
                cv_input.send_keys(cv_path)
                time.sleep(random.uniform(2, 3))
            except:
                pass
            
            # Submit application
            submit_selectors = [
                'button[type="submit"]',
                'button:contains("Submit Application")',
                'button[aria-label*="Submit"]'
            ]
            
            for selector in submit_selectors:
                try:
                    submit_btn = driver.find_element(By.CSS_SELECTOR, selector)
                    submit_btn.click()
                    time.sleep(random.uniform(3, 5))
                    
                    # Take screenshot for verification
                    screenshot_path = f"/tmp/application_{datetime.now().timestamp()}.png"
                    driver.save_screenshot(screenshot_path)
                    
                    return {
                        'success': True,
                        'method': 'easy_apply',
                        'screenshot': screenshot_path,
                        'message': 'Application submitted via Easy Apply'
                    }
                    
                except:
                    continue
            
            return {'success': False, 'message': 'Could not submit form'}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _remove_duplicates(self, jobs: List[Dict]) -> List[Dict]:
        """Remove duplicate job listings"""
        seen = set()
        unique_jobs = []
        
        for job in jobs:
            # Create unique identifier
            job_id = f"{job.get('platform')}_{job.get('job_id')}_{job.get('title')}_{job.get('company')}"
            
            if job_id not in seen:
                seen.add(job_id)
                unique_jobs.append(job)
        
        return unique_jobs

# Main job search and application manager
class JobApplicationManager:
    def __init__(self, applicant_id: str, preferences: Dict):
        self.applicant_id = applicant_id
        self.preferences = preferences
        self.scraper = JobScraper()
        self.applications_log = []
        
    def run_daily_search_and_apply(self):
        """Run daily job search and auto-application"""
        print(f"Starting daily job search for applicant {self.applicant_id}")
        
        # Search for jobs based on preferences
        keywords = self.preferences.get('jobTitles', []) + self.preferences.get('industries', [])
        location = self.preferences.get('locations', ['South Africa'])[0]
        
        jobs = self.scraper.search_jobs(
            keywords=keywords,
            location=location,
            max_pages=3
        )
        
        print(f"Found {len(jobs)} potential jobs")
        
        # Filter jobs based on preferences
        filtered_jobs = self._filter_jobs(jobs)
        print(f"Filtered to {len(filtered_jobs)} matching jobs")
        
        # Apply for top matching jobs (max 10 per day)
        max_daily_applications = 10
        applications_today = 0
        
        for job in filtered_jobs[:max_daily_applications]:
            if applications_today >= max_daily_applications:
                break
            
            # Check if not already applied
            if not self._already_applied(job['job_id']):
                print(f"Applying for: {job['title']} at {job['company']}")
                
                # Load applicant data and documents
                applicant_data = self._load_applicant_data()
                cv_path = self._get_cv_path()
                cover_letter_path = self._generate_cover_letter(job)
                
                # Apply for job
                result = self.scraper.auto_apply(
                    job=job,
                    applicant_data=applicant_data,
                    cv_path=cv_path,
                    cover_letter_path=cover_letter_path
                )
                
                # Log application
                self._log_application(job, result)
                applications_today += 1
                
                # Avoid rate limiting
                time.sleep(random.uniform(10, 30))
        
        return {
            'applicant_id': self.applicant_id,
            'date': datetime.now().isoformat(),
            'jobs_found': len(jobs),
            'jobs_filtered': len(filtered_jobs),
            'applications_submitted': applications_today,
            'total_applications': len(self.applications_log)
        }
    
    def _filter_jobs(self, jobs: List[Dict]) -> List[Dict]:
        """Filter jobs based on preferences"""
        filtered = []
        
        for job in jobs:
            # Check salary range if specified
            if 'salaryRange' in self.preferences:
                salary_match = self._check_salary_match(job)
                if not salary_match:
                    continue
            
            # Check employment type
            if 'employmentTypes' in self.preferences:
                emp_type_match = self._check_employment_type_match(job)
                if not emp_type_match:
                    continue
            
            # Check location
            if 'locations' in self.preferences:
                location_match = self._check_location_match(job)
                if not location_match:
                    continue
            
            filtered.append(job)
        
        return filtered
    
    def _check_salary_match(self, job: Dict) -> bool:
        """Check if job salary matches preferences"""
        # Implementation depends on salary data availability
        # Many job platforms don't show salaries
        return True  # Default to True if salary not specified
    
    def _check_employment_type_match(self, job: Dict) -> bool:
        """Check employment type match"""
        job_title_lower = job['title'].lower()
        
        for emp_type in self.preferences.get('employmentTypes', []):
            if emp_type.lower() in job_title_lower:
                return True
        
        return False
    
    def _check_location_match(self, job: Dict) -> bool:
        """Check location match"""
        job_location_lower = job.get('location', '').lower()
        
        for pref_location in self.preferences.get('locations', []):
            if pref_location.lower() in job_location_lower:
                return True
        
        return False
    
    def _already_applied(self, job_id: str) -> bool:
        """Check if already applied for this job"""
        for app in self.applications_log:
            if app.get('job_id') == job_id:
                return True
        return False
    
    def _load_applicant_data(self) -> Dict:
        """Load applicant data from database"""
        # In production, this would fetch from database
        return {
            'personalInfo': {
                'firstName': 'John',
                'lastName': 'Doe',
                'email': 'john@example.com',
                'phone': '+27721234567'
            }
        }
    
    def _get_cv_path(self) -> str:
        """Get enhanced CV file path"""
        return "/tmp/enhanced_cv.pdf"
    
    def _generate_cover_letter(self, job: Dict) -> str:
        """Generate job-specific cover letter"""
        # This would use the AI service to generate cover letter
        return "/tmp/cover_letter.pdf"
    
    def _log_application(self, job: Dict, result: Dict):
        """Log application result"""
        application_record = {
            'job_id': job['job_id'],
            'job_title': job['title'],
            'company': job['company'],
            'platform': job['platform'],
            'applied_date': datetime.now().isoformat(),
            'result': result,
            'status': 'applied' if result['success'] else 'failed'
        }
        
        self.applications_log.append(application_record)
        
        # In production, save to database
        print(f"Logged application: {job['title']} - {result['success']}")

# Example usage
if __name__ == "__main__":
    # Example preferences
    preferences = {
        'jobTitles': ['Software Engineer', 'Developer', 'Programmer'],
        'industries': ['Technology', 'IT', 'Software'],
        'locations': ['Johannesburg', 'Cape Town', 'Remote'],
        'employmentTypes': ['Full-time', 'Permanent'],
        'remotePreference': 'hybrid'
    }
    
    manager = JobApplicationManager('APP-12345', preferences)
    result = manager.run_daily_search_and_apply()
    print(json.dumps(result, indent=2))
