import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { crawlRequestSchema, type CrawlRequest, type CrawlResult } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatUrl, downloadMarkdown, copyToClipboard } from "@/lib/utils";
import { 
  Search, 
  Copy, 
  Download, 
  Trash2, 
  Settings, 
  ChevronDown, 
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Globe,
  Filter,
  Clock,
  Image,
  Table
} from "lucide-react";

export default function Home() {
  const [currentResult, setCurrentResult] = useState<CrawlResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { toast } = useToast();

  const form = useForm<CrawlRequest>({
    resolver: zodResolver(crawlRequestSchema),
    defaultValues: {
      url: "",
      removeImages: false,
      removeLinks: false,
      cleanMode: true,
      extractMetadata: false,
      crawlDepth: 1,
      maxPages: 1,
      includeSubdomains: false,
      followExternalLinks: false,
      waitForSelector: "",
      excludePatterns: [],
      includePatterns: [],
      customHeaders: {},
      timeout: 30,
      extractImages: false,
      extractTables: true,
      wordCountThreshold: 1,
      onlyMainContent: true,
    },
  });

  const { data: recentCrawls } = useQuery<CrawlResult[]>({
    queryKey: ["/api/crawl-results"],
  });

  const crawlMutation = useMutation({
    mutationFn: async (data: CrawlRequest) => {
      const response = await apiRequest("POST", "/api/crawl", data);
      return await response.json();
    },
    onSuccess: (result: CrawlResult) => {
      setCurrentResult(result);
      toast({
        title: "Success!",
        description: "Page crawled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crawl-results"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Crawling Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CrawlRequest) => {
    crawlMutation.mutate(data);
  };

  const handleCopy = async () => {
    if (!currentResult) return;
    
    try {
      await copyToClipboard(currentResult.markdown);
      toast({
        title: "Copied!",
        description: "Markdown copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    if (!currentResult) return;
    
    const domain = formatUrl(currentResult.url);
    const filename = `${domain}_${Date.now()}.md`;
    downloadMarkdown(currentResult.markdown, filename);
    
    toast({
      title: "Downloaded!",
      description: "Markdown file downloaded successfully",
    });
  };

  const handleClear = () => {
    setCurrentResult(null);
    form.reset();
  };

  const handleLoadRecent = (url: string) => {
    form.setValue("url", url);
  };

  const getWordCount = (text: string) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Search className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Crawl4AI</h1>
              <p className="text-sm text-slate-600">Web Page to Markdown Converter</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* URL Input Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Enter URL to Crawl</CardTitle>
            <p className="text-sm text-slate-600">Extract clean markdown content from any web page</p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website URL</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                placeholder="https://example.com/article"
                                {...field}
                                className="pr-10"
                              />
                              <ExternalLink className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <Button 
                      type="submit" 
                      disabled={crawlMutation.isPending}
                      className="h-10"
                    >
                      {crawlMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Crawl Page
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Advanced Options */}
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-slate-700 hover:text-slate-900">
                      <Settings className="mr-2 h-4 w-4" />
                      Advanced Options
                      <ChevronDown className={`ml-2 h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                      <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="basic">Basic</TabsTrigger>
                          <TabsTrigger value="crawling">
                            <Globe className="mr-1 h-3 w-3" />
                            Crawling
                          </TabsTrigger>
                          <TabsTrigger value="content">
                            <Filter className="mr-1 h-3 w-3" />
                            Content
                          </TabsTrigger>
                          <TabsTrigger value="performance">
                            <Clock className="mr-1 h-3 w-3" />
                            Performance
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="basic" className="space-y-4 mt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="removeImages"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm">Remove images</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="removeLinks"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm">Remove links</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="cleanMode"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm">Clean mode</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="extractMetadata"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm">Extract metadata</FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="crawling" className="space-y-4 mt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="crawlDepth"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Crawl Depth</FormLabel>
                                  <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select depth" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="1">1 (Current page only)</SelectItem>
                                      <SelectItem value="2">2 (Include linked pages)</SelectItem>
                                      <SelectItem value="3">3 (Deep crawl)</SelectItem>
                                      <SelectItem value="4">4 (Very deep)</SelectItem>
                                      <SelectItem value="5">5 (Maximum depth)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>How many levels deep to crawl</FormDescription>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="maxPages"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Max Pages</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number"
                                      min="1"
                                      max="100"
                                      value={field.value || 1}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                    />
                                  </FormControl>
                                  <FormDescription>Maximum number of pages to crawl</FormDescription>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="includeSubdomains"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1">
                                    <FormLabel className="text-sm">Include subdomains</FormLabel>
                                    <FormDescription className="text-xs">Crawl subdomains of the target site</FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="followExternalLinks"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1">
                                    <FormLabel className="text-sm">Follow external links</FormLabel>
                                    <FormDescription className="text-xs">Include links to other domains</FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="content" className="space-y-4 mt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="extractImages"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1">
                                    <FormLabel className="text-sm">Extract images</FormLabel>
                                    <FormDescription className="text-xs">Include image URLs and alt text</FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="extractTables"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1">
                                    <FormLabel className="text-sm">Extract tables</FormLabel>
                                    <FormDescription className="text-xs">Convert HTML tables to markdown</FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="onlyMainContent"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox 
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1">
                                    <FormLabel className="text-sm">Main content only</FormLabel>
                                    <FormDescription className="text-xs">Skip headers, footers, and sidebars</FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="wordCountThreshold"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Word count threshold</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number"
                                      min="0"
                                      max="1000"
                                      value={field.value || 1}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                    />
                                  </FormControl>
                                  <FormDescription>Minimum words per content block</FormDescription>
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={form.control}
                            name="waitForSelector"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Wait for selector (optional)</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="e.g., .main-content, #article"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>CSS selector to wait for before crawling</FormDescription>
                              </FormItem>
                            )}
                          />
                        </TabsContent>
                        
                        <TabsContent value="performance" className="space-y-4 mt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="timeout"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Timeout (seconds)</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number"
                                      min="5"
                                      max="120"
                                      value={field.value || 30}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                                    />
                                  </FormControl>
                                  <FormDescription>Maximum time to wait for page load</FormDescription>
                                </FormItem>
                              )}
                            />
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Loading Indicator */}
        {crawlMutation.isPending && (
          <Alert className="mb-6 bg-amber-50 border-amber-200">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Processing your request...</strong>
              <br />
              This may take a few seconds depending on the page size.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {crawlMutation.isError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Crawling Failed</strong>
              <br />
              {crawlMutation.error?.message || "An unexpected error occurred"}
            </AlertDescription>
          </Alert>
        )}

        {/* Results Section */}
        {currentResult && (
          <Card className="mb-8">
            <CardHeader className="bg-slate-50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Markdown Results</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">{currentResult.url}</p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClear}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative">
                <div className="absolute top-4 right-4 z-10">
                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <span>{currentResult.characterCount.toLocaleString()} characters</span>
                    <span>•</span>
                    <span>{currentResult.wordCount.toLocaleString()} words</span>
                  </div>
                </div>
                <Textarea 
                  value={currentResult.markdown}
                  readOnly
                  className="min-h-96 font-mono text-sm border-0 rounded-none resize-none focus:ring-0"
                  placeholder="Markdown content will appear here..."
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Crawls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Crawls</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCrawls && recentCrawls.length > 0 ? (
              <div className="space-y-2">
                {recentCrawls.map((crawl) => (
                  <div 
                    key={crawl.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                    onClick={() => handleLoadRecent(crawl.url)}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{crawl.url}</p>
                      <p className="text-xs text-slate-600">{formatDate(crawl.crawledAt)}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No recent crawls yet</p>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="mt-16 bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center text-sm text-slate-600">
            <p>Powered by <a href="https://github.com/SAHLinux/Crawl4AI-GUI" className="text-blue-600 hover:text-blue-800">Crawl4AI</a></p>
            <p className="mt-2">Extract clean markdown content from any web page</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
