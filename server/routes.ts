import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { crawlRequestSchema } from "@shared/schema";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

export async function registerRoutes(app: Express): Promise<Server> {
  // Crawl endpoint
  app.post("/api/crawl", async (req, res) => {
    try {
      const validatedData = crawlRequestSchema.parse(req.body);
      
      // Call Crawl4AI Python script
      const result = await crawlWithPython(validatedData);
      
      // Store result in memory
      const crawlResult = await storage.createCrawlResult({
        url: validatedData.url,
        markdown: result.markdown,
        title: result.title,
        characterCount: result.markdown.length,
        wordCount: result.markdown.trim() ? result.markdown.trim().split(/\s+/).length : 0,
      });

      res.json(crawlResult);
    } catch (error) {
      console.error("Crawl error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to crawl the page" 
      });
    }
  });

  // Get recent crawl results
  app.get("/api/crawl-results", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const results = await storage.getCrawlResults(limit);
      res.json(results);
    } catch (error) {
      console.error("Get crawl results error:", error);
      res.status(500).json({ 
        message: "Failed to fetch crawl results" 
      });
    }
  });

  // Get specific crawl result
  app.get("/api/crawl-results/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.getCrawlResult(id);
      
      if (!result) {
        return res.status(404).json({ message: "Crawl result not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Get crawl result error:", error);
      res.status(500).json({ 
        message: "Failed to fetch crawl result" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function crawlWithPython(options: any): Promise<{ markdown: string; title: string }> {
  return new Promise((resolve, reject) => {
    // Convert JavaScript booleans to Python booleans
    const removeLinks = options.removeLinks ? 'True' : 'False';
    const removeImages = options.removeImages ? 'True' : 'False';
    const extractImages = options.extractImages ? 'True' : 'False';
    const extractTables = options.extractTables ? 'True' : 'False';
    const onlyMainContent = options.onlyMainContent ? 'True' : 'False';
    const includeSubdomains = options.includeSubdomains ? 'True' : 'False';
    const followExternalLinks = options.followExternalLinks ? 'True' : 'False';
    
    // Create a Python script that uses alternative approaches when browser fails
    const pythonScript = `
import asyncio
import json
import sys
import os
import requests
from bs4 import BeautifulSoup
import html2text
from urllib.parse import urljoin, urlparse

def fallback_crawl(url, config):
    """Enhanced fallback method with multi-page crawling support"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Add custom headers if provided
        custom_headers = ${JSON.stringify(options.customHeaders || {})}
        headers.update(custom_headers)
        
        visited_urls = set()
        all_content = []
        urls_to_visit = [url]
        max_pages = config.get('max_pages', 1)
        crawl_depth = config.get('crawl_depth', 1)
        include_subdomains = config.get('include_subdomains', False)
        follow_external = config.get('follow_external_links', False)
        
        base_domain = urlparse(url).netloc
        pages_crawled = 0
        
        print(f"Starting multi-page crawl: max_pages={max_pages}, depth={crawl_depth}", file=sys.stderr)
        
        while urls_to_visit and pages_crawled < max_pages:
            current_url = urls_to_visit.pop(0)
            if current_url in visited_urls:
                continue
                
            try:
                print(f"Crawling page {pages_crawled + 1}: {current_url}", file=sys.stderr)
                response = requests.get(current_url, headers=headers, timeout=${options.timeout || 30})
                response.raise_for_status()
                visited_urls.add(current_url)
                pages_crawled += 1
                
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Extract title from first page only
                if pages_crawled == 1:
                    title_elem = soup.find('title')
                    main_title = title_elem.get_text().strip() if title_elem else "Untitled"
                
                # Find links for next pages if we haven't reached max depth
                if pages_crawled < max_pages and crawl_depth > 1:
                    for link in soup.find_all('a', href=True):
                        href = link['href']
                        if href.startswith('#') or href.startswith('mailto:') or href.startswith('tel:'):
                            continue
                            
                        # Convert relative URLs to absolute
                        if href.startswith('/') or href.startswith('./') or not href.startswith('http'):
                            href = urljoin(current_url, href)
                        
                        parsed_link = urlparse(href)
                        link_domain = parsed_link.netloc
                        
                        # Apply domain filtering rules
                        should_include = False
                        if link_domain == base_domain:
                            should_include = True
                        elif include_subdomains and (link_domain.endswith('.' + base_domain) or base_domain.endswith('.' + link_domain)):
                            should_include = True
                        elif follow_external:
                            should_include = True
                            
                        if should_include and href not in visited_urls and href not in urls_to_visit:
                            urls_to_visit.append(href)
                
                # Process current page content
                page_soup = BeautifulSoup(response.content, 'html.parser')
                
                # Wait for selector simulation
                wait_selector = "${options.waitForSelector || ''}"
                if wait_selector and not page_soup.select(wait_selector):
                    print(f"Warning: Selector '{wait_selector}' not found on {current_url}", file=sys.stderr)
                
                # Extract main content if specified
                if ${onlyMainContent}:
                    main_content = (
                        page_soup.find('main') or 
                        page_soup.find('article') or 
                        page_soup.find(class_=['content', 'main-content', 'article-content', 'post-content']) or
                        page_soup.find(id=['content', 'main', 'article', 'post'])
                    )
                    if main_content:
                        page_soup = BeautifulSoup(str(main_content), 'html.parser')
                
                # Remove unwanted elements
                for script in page_soup(["script", "style", "noscript"]):
                    script.decompose()
                    
                if ${onlyMainContent}:
                    for element in page_soup(['nav', 'footer', 'aside', 'header']):
                        element.decompose()
                    for element in page_soup.find_all(class_=['nav', 'navigation', 'sidebar', 'footer', 'header', 'menu']):
                        element.decompose()
                
                # Handle tables and images
                if not ${extractTables}:
                    for table in page_soup.find_all('table'):
                        table.decompose()
                        
                if not ${extractImages} and ${removeImages}:
                    for img in page_soup.find_all('img'):
                        img.decompose()
                
                # Convert to markdown
                h = html2text.HTML2Text()
                h.ignore_links = ${removeLinks}
                h.ignore_images = ${removeImages}
                h.body_width = 0
                h.unicode_snob = True
                
                page_markdown = h.handle(str(page_soup))
                
                # Apply word count filtering
                word_threshold = ${options.wordCountThreshold || 1}
                if word_threshold > 1:
                    lines = page_markdown.split('\\n')
                    filtered_lines = []
                    for line in lines:
                        if len(line.split()) >= word_threshold or line.startswith('#') or line.strip() == '':
                            filtered_lines.append(line)
                    page_markdown = '\\n'.join(filtered_lines)
                
                # Add page separator for multi-page content
                if pages_crawled > 1:
                    all_content.append(f"\\n\\n--- Page {pages_crawled}: {current_url} ---\\n\\n")
                
                all_content.append(page_markdown.strip())
                
            except Exception as page_error:
                print(f"Error crawling {current_url}: {str(page_error)}", file=sys.stderr)
                continue
        
        # Combine all content
        combined_markdown = '\\n\\n'.join(filter(None, all_content))
        
        print(f"Crawl completed: {pages_crawled} pages processed", file=sys.stderr)
        
        return {
            "markdown": combined_markdown,
            "title": main_title if 'main_title' in locals() else "Multi-page Crawl Results"
        }
        
    except Exception as e:
        raise Exception(f"Multi-page crawl failed: {str(e)}")

async def crawl_url():
    try:
        config = {
            "crawl_depth": ${options.crawlDepth || 1},
            "max_pages": ${options.maxPages || 1},
            "include_subdomains": ${includeSubdomains},
            "follow_external_links": ${followExternalLinks},
            "timeout": ${options.timeout || 30},
            "word_count_threshold": ${options.wordCountThreshold || 1}
        }
        
        # First try Crawl4AI
        try:
            from crawl4ai import AsyncWebCrawler
            
            crawler_config = {
                "verbose": False,
                "headless": True
            }
            
            async with AsyncWebCrawler(**crawler_config) as crawler:
                crawl_params = {
                    "url": "${options.url}",
                    "word_count_threshold": ${options.wordCountThreshold || 1},
                    "bypass_cache": True,
                    "remove_images": ${removeImages},
                    "remove_links": ${removeLinks}
                }
                
                # Add wait for selector if provided
                wait_selector = "${options.waitForSelector || ''}"
                if wait_selector:
                    crawl_params["wait_for"] = wait_selector
                
                result = await crawler.arun(**crawl_params)
                
                if result.success:
                    output = {
                        "markdown": result.markdown or "",
                        "title": result.metadata.get("title", "Untitled") if result.metadata else "Untitled"
                    }
                    print(json.dumps(output))
                    return
                else:
                    print("Crawl4AI failed, trying fallback method...", file=sys.stderr)
                    raise Exception("Crawl4AI failed")
        except Exception as crawl4ai_error:
            print(f"Crawl4AI error: {crawl4ai_error}", file=sys.stderr)
            print("Using fallback method...", file=sys.stderr)
            
            # Use fallback method
            result = fallback_crawl("${options.url}", config)
            print(json.dumps(result))
            
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(crawl_url())
`;

    // Write the Python script to a temporary file
    const tempDir = os.tmpdir();
    const scriptPath = path.join(tempDir, `crawl_${Date.now()}.py`);
    
    fs.writeFileSync(scriptPath, pythonScript);

    const python = spawn('python3', [scriptPath], {
      timeout: 60000, // 60 second timeout for complex pages
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      // Clean up the temporary file
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {
        console.warn('Failed to cleanup temp file:', e);
      }

      if (code === 0) {
        try {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);
          
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve({
              markdown: result.markdown || '',
              title: result.title || 'Untitled'
            });
          }
        } catch (e) {
          reject(new Error(`Failed to parse crawl result: ${e instanceof Error ? e.message : String(e)}`));
        }
      } else {
        let errorMessage = 'Failed to crawl the page';
        if (stderr) {
          try {
            const errorLines = stderr.trim().split('\n');
            const lastErrorLine = errorLines[errorLines.length - 1];
            const errorObj = JSON.parse(lastErrorLine);
            errorMessage = errorObj.error || errorMessage;
          } catch {
            // If we can't parse as JSON, use the stderr as is
            errorMessage = stderr.includes('crawl4ai') ? 
              'Crawl4AI error: ' + stderr.split('\n').pop() : 
              stderr.split('\n').pop() || errorMessage;
          }
        }
        reject(new Error(errorMessage));
      }
    });

    python.on('error', (error) => {
      // Clean up the temporary file
      try {
        fs.unlinkSync(scriptPath);
      } catch {}
      
      if (error.message.includes('ENOENT')) {
        reject(new Error('Python3 not found. Please install Python 3 and crawl4ai package.'));
      } else {
        reject(new Error(`Python execution failed: ${error.message}`));
      }
    });
  });
}
