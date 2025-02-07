import bcrypt from "bcrypt";
import { IDatabaseService } from "../database-service";
import express from "express";
import http from "http";

export type AuthResponse = {
  isAuthenticated: boolean;
  code: number;
  message: string;
};

export class AuthService {
  private readonly databaseService: IDatabaseService;

  constructor(dbService: IDatabaseService) {
    this.databaseService = dbService;
  }

  private async addUser(username: string, password: string): Promise<void> {
    const salt = await bcrypt.genSalt(10);
    const dbData = this.databaseService.getData();
    dbData.auth[username] = {
      passwordHash: await bcrypt.hash(password, salt),
    };

    await this.databaseService.save(dbData);
  }

  private async authenticate(authHeader: string): Promise<boolean> {
    const [method, credentials] = authHeader.split(" ");
    if (method !== "Basic") return false;

    const [username, password] = Buffer.from(credentials, "base64")
        .toString()
        .split(":");

    const user = this.databaseService.getData().auth?.[username];
    if (!user) return false;

    return bcrypt.compare(password, user.passwordHash);
  }

  async initialize(): Promise<void> {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) return;
    await this.addUser(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
  }

  async proxyAuth(
    req: express.Request,
    res: express.Response,
  ): Promise<AuthResponse> {
    const authHeader = req.headers["proxy-authorization"];

    if (!authHeader) {
      res.setHeader("Proxy-Authenticate", "Basic");
      return {
        isAuthenticated: false,
        code: 407,
        message: "Proxy Authentication Required\r\n\r\n",
      };
    }

    const isAuthenticated = await this.authenticate(authHeader);

    if (!isAuthenticated) {
      return {
        isAuthenticated: false,
        code: 403,
        message: "Invalid credentials\r\n\r\n",
      };
    }

    return {
      isAuthenticated: true,
      code: 200,
      message: "OK\r\n\r\n",
    };
  }

  async endpointAuth(
    req: express.Request,
    res: express.Response,
  ): Promise<AuthResponse> {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      res.setHeader("WWW-Authenticate", "Basic");
      return {
        isAuthenticated: false,
        code: 401,
        message: "Unauthorized\r\n\r\n",
      };
    }

    const isAuthenticated = await this.authenticate(authHeader);
    if (!isAuthenticated) {
      return {
        isAuthenticated: false,
        code: 403,
        message: "Invalid credentials\r\n\r\n",
      };
    }

    return {
      isAuthenticated: true,
      code: 200,
      message: "OK\r\n\r\n",
    };
  }

  async tunnelAuth(req: http.IncomingMessage): Promise<AuthResponse> {
    const authHeader = req.headers["proxy-authorization"];

    if (!authHeader) {
      return {
        isAuthenticated: false,
        code: 407,
        message: "Proxy Authentication Required\r\n\r\n",
      };
    }

    const isAuthenticated = await this.authenticate(authHeader);
    if (!isAuthenticated) {
      return {
        isAuthenticated: false,
        code: 403,
        message: "Invalid credentials\r\n\r\n",
      };
    }

    return {
      isAuthenticated: true,
      code: 200,
      message: "OK\r\n\r\n",
    };
  }
}
