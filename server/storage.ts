import { users, crawlResults, type User, type InsertUser, type CrawlResult, type InsertCrawlResult } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getCrawlResults(limit?: number): Promise<CrawlResult[]>;
  createCrawlResult(result: InsertCrawlResult): Promise<CrawlResult>;
  getCrawlResult(id: number): Promise<CrawlResult | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getCrawlResults(limit: number = 10): Promise<CrawlResult[]> {
    const results = await db
      .select()
      .from(crawlResults)
      .orderBy(desc(crawlResults.crawledAt))
      .limit(limit);
    return results;
  }

  async createCrawlResult(insertResult: InsertCrawlResult): Promise<CrawlResult> {
    const [result] = await db
      .insert(crawlResults)
      .values(insertResult)
      .returning();
    return result;
  }

  async getCrawlResult(id: number): Promise<CrawlResult | undefined> {
    const [result] = await db.select().from(crawlResults).where(eq(crawlResults.id, id));
    return result || undefined;
  }
}

export const storage = new DatabaseStorage();
