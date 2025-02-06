import fs from "fs/promises";
import path from "path";

import { DBRecord, Metrics } from "../../types";

export class DatabaseService {
  private readonly dbPath: string;
  private data: Record<string, DBRecord>;

  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, "db.json");
    this.data = {};
  }

  private getDefaultRecord(url: string): DBRecord {
    return {
      url,
      visits: 0,
      bytesTransferred: 0,
    };
  }

  async initialize(): Promise<void> {
    try {
      const dbFileExists = await fs
        .access(this.dbPath)
        .then(() => true)
        .catch(() => false);

      if (!dbFileExists) {
        console.log("Creating new DB file at ", this.dbPath);
        await fs.writeFile(this.dbPath, "{}");
      }

      const fileContent = await fs.readFile(this.dbPath, "utf-8");
      this.data = JSON.parse(fileContent);
    } catch (error) {
      console.error("Failed to initialize DB: ", error);
    }
  }

  async save(): Promise<void> {
    try {
      await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error("Failed to save DB: ", error);
    }
  }

  updateMetrics(url: string, bytes: number): void {
    const record = this.data[url] || this.getDefaultRecord(url);
    record.visits += 1;
    record.bytesTransferred += bytes;
    this.data[url] = record;
  }

  getMetrics(): Metrics {
    let totalBytes = 0;
    const sites: Record<string,  number> = {};

    for (const [url, record] of Object.entries(this.data)) {
      totalBytes += record.bytesTransferred;
      sites[url] = record.visits;
    }

    const topSites = Object.entries(sites)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, visits]) => ({ url, visits }));

    return {
      bandwidth_usage: `${(totalBytes / (1024 * 1024)).toFixed(2)}MB`,
      top_sites: topSites,
    };
  }
}
