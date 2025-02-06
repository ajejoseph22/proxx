import fs from "fs/promises";
import path from "path";

import { ProxyDBRecord, AuthDBRecord } from "../../types";

export interface DBSchema {
  auth: Record<string, AuthDBRecord>;
  metrics: Record<string, ProxyDBRecord>;
}

export interface IDatabaseService {
  initialize(): Promise<void>;
  save(data: DBSchema): Promise<void>;
  getData(): DBSchema;
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class DatabaseService {
  private readonly dbPath: string;

  private data: DBSchema = { auth: {}, metrics: {} };

  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, "db.json");
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
      throw new DatabaseError("Failed to initialize DB", error as Error);
    }
  }

  async save(data: DBSchema): Promise<void> {
    try {
      await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
      this.data = data;
    } catch (error) {
      throw new DatabaseError("Failed to save DB", error as Error);
    }
  }

  getData(): DBSchema {
    return { ...this.data };
  }
}
