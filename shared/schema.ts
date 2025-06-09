import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const crawlResults = pgTable("crawl_results", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  markdown: text("markdown").notNull(),
  title: text("title"),
  crawledAt: timestamp("crawled_at").defaultNow().notNull(),
  characterCount: integer("character_count").notNull(),
  wordCount: integer("word_count").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCrawlResultSchema = createInsertSchema(crawlResults).omit({
  id: true,
  crawledAt: true,
});

export const crawlRequestSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  removeImages: z.boolean().optional().default(false),
  removeLinks: z.boolean().optional().default(false),
  cleanMode: z.boolean().optional().default(true),
  extractMetadata: z.boolean().optional().default(false),
  
  // Advanced crawling options
  crawlDepth: z.number().min(1).max(5).optional().default(1),
  maxPages: z.number().min(1).max(100).optional().default(1),
  includeSubdomains: z.boolean().optional().default(false),
  followExternalLinks: z.boolean().optional().default(false),
  waitForSelector: z.string().optional(),
  excludePatterns: z.array(z.string()).optional().default([]),
  includePatterns: z.array(z.string()).optional().default([]),
  customHeaders: z.record(z.string()).optional().default({}),
  timeout: z.number().min(5).max(120).optional().default(30),
  extractImages: z.boolean().optional().default(false),
  extractTables: z.boolean().optional().default(true),
  wordCountThreshold: z.number().min(0).max(1000).optional().default(1),
  onlyMainContent: z.boolean().optional().default(true),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CrawlResult = typeof crawlResults.$inferSelect;
export type InsertCrawlResult = z.infer<typeof insertCrawlResultSchema>;
export type CrawlRequest = z.infer<typeof crawlRequestSchema>;
