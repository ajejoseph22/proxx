import bcrypt from "bcrypt";
import express from "express";
import http from "http";

import { IDatabaseService } from "../database-service";

export type AuthResponse = {
  isAuthenticated: boolean;
  code: number;
  message: string;
};

export class AuthService {
  private readonly databaseService: IDatabaseService;
  private readonly statusCode = {
    UNAUTHORIZED: 401,
    PROXY_AUTH_REQUIRED: 407,
    FORBIDDEN: 403,
    OK: 200,
  };

  constructor(dbService: IDatabaseService) {
    this.databaseService = dbService;
  }

  private async addUser(username: string, password: string): Promise<void> {
    const salt = await bcrypt.genSalt(10);
    const auth = this.databaseService.getData().auth;
    auth[username] = {
      passwordHash: await bcrypt.hash(password, salt),
    };
    await this.databaseService.save({ auth });
  }

  private async isAuthenticated(authHeader: string): Promise<boolean> {
    const [method, credentials] = authHeader.split(" ");
    if (method !== "Basic") return false;

    const [username, password] = Buffer.from(credentials, "base64")
      .toString()
      .split(":");

    const user = this.databaseService.getData().auth?.[username];
    if (!user) return false;

    return bcrypt.compare(password, user.passwordHash);
  }

  private async handleAuth(
    authHeader: string | undefined,
    isProxyAuth: boolean,
  ): Promise<AuthResponse> {
    if (!authHeader) {
      return {
        isAuthenticated: false,
        code: isProxyAuth
          ? this.statusCode.PROXY_AUTH_REQUIRED
          : this.statusCode.UNAUTHORIZED,
        message: "Authentication Required\r\n\r\n",
      };
    }

    const isAuthenticated = await this.isAuthenticated(authHeader);
    return {
      isAuthenticated,
      code: isAuthenticated ? this.statusCode.OK : this.statusCode.FORBIDDEN,
      message: `${isAuthenticated ? "OK" : "Invalid credentials"}\r\n\r\n}`,
    };
  }

  async initialize(): Promise<void> {
    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
      await this.addUser(
        process.env.ADMIN_USERNAME,
        process.env.ADMIN_PASSWORD,
      );
    }
  }

  async proxyAuth(
    req: express.Request | http.IncomingMessage,
    res?: express.Response,
  ): Promise<AuthResponse> {
    res?.setHeader("Proxy-Authenticate", "Basic");
    return this.handleAuth(req.headers["proxy-authorization"], true);
  }

  async endpointAuth(
    req: express.Request,
    res: express.Response,
  ): Promise<AuthResponse> {
    res.setHeader("WWW-Authenticate", "Basic");
    return this.handleAuth(req.headers["authorization"], false);
  }
}
