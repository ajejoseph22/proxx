import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import http from "http";
import net from "net";
import { URL } from "url";

import { MetricsService } from "./services/metrics-service";
import { AuthService } from "./services/auth-service";
import { DatabaseService } from "./services/database-service";

type RequestWithBytes = http.IncomingMessage & { requestBytes?: number };

export class Proxx {
  private readonly app: express.Application;
  private readonly dbService: DatabaseService;
  private readonly metricsService: MetricsService;
  private readonly authService: AuthService;
  private readonly endpointPaths: string[];
  private server: http.Server;

  constructor(private port: number) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.dbService = new DatabaseService();
    this.metricsService = new MetricsService(this.dbService);
    this.authService = new AuthService(this.dbService);
    this.endpointPaths = ["/metrics"];
    this.setupMiddleware();
    this.setupEndpoints();
    this.setupProxy();
  }

  private isProxyRequest(req: express.Request): boolean {
    return !this.endpointPaths.includes(req.url);
  }

  private setupMiddleware(): void {
    this.app.use(async (req, res, next) => {
      const { isAuthenticated, message, code } = this.isProxyRequest(req)
        ? await this.authService.proxyAuth(req, res)
        : await this.authService.endpointAuth(req, res);

      if (!isAuthenticated) {
        res.status(code).send(message);
        return;
      }

      next();
    });
  }

  private setupProxy(): void {
    this.app.use(
      "/",
      createProxyMiddleware({
        target: "https://example.com",
        router: (req) => {
          console.log(`Proxying request to: ${req.url}`);
          return req.url;
        },
        changeOrigin: true,
        on: {
          proxyReq: (_, req: RequestWithBytes, res) => {
            let requestBytes = 0;

            req.on("data", (chunk) => {
              requestBytes += chunk.length;
            });

            req.on("end", async () => {
              req.requestBytes = requestBytes;
            });
          },
          proxyRes: (proxyRes, req: RequestWithBytes, res) => {
            const url = new URL(req.url || "", `http://${req.headers.host}`)
              .hostname;
            let responseBytes = 0;

            proxyRes.on("data", (chunk) => {
              responseBytes += chunk.length;
            });

            proxyRes.on("end", async () => {
              console.log("Request bytes:", req.requestBytes);
              console.log("Response bytes:", responseBytes);
              const totalBytes = (req.requestBytes || 0) + responseBytes;
              await this.metricsService.updateMetrics(url, totalBytes);
            });
          },
        },
      }),
    );
  }

  private setupEndpoints(): void {
    this.app.get("/metrics", (_, res) => {
      const metrics = this.metricsService.getAllMetrics();
      res.json(metrics);
    });
  }

  async start(): Promise<void> {
    await this.dbService.initialize();
    await this.authService.initialize();

    this.server = this.app.listen(this.port, () => {
      console.log(`Proxx is running on port ${this.port}`);
    });

    // Handle HTTPS tunneling (CONNECT requests)
    this.server.on("connect", async (req, clientSocket, head) => {
      const { isAuthenticated, message, code } =
        await this.authService.proxyAuth(req);

      if (!isAuthenticated) {
        clientSocket.write(`HTTP/1.1 ${code} ${message}`);
        clientSocket.end();
        return;
      }

      if (!req.url) {
        console.error("Invalid CONNECT request:", req.url);
        clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
        return;
      }

      const [hostname, port] = req.url.split(":");

      if (!hostname || !port) {
        console.error("Invalid CONNECT request:", req.url);
        clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
        return;
      }

      // Establish TCP connection to the target server
      const serverSocket = net.connect(Number(port), hostname, () => {
        console.log(`Tunnel established to ${hostname}:${port}`);
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });

      let clientBytes = 0;
      let serverBytes = 0;

      clientSocket.on("data", (chunk) => {
        clientBytes += chunk.length;
      });

      serverSocket.on("data", (chunk) => {
        serverBytes += chunk.length;
      });

      clientSocket.on("end", async () => {
        console.log("Client bytes:", clientBytes);
        console.log("Server bytes:", serverBytes);
        const totalBytes = clientBytes + serverBytes;
        await this.metricsService.updateMetrics(hostname, totalBytes);
      });

      serverSocket.on("error", (err) => {
        console.error(
          `Error in tunnel to ${hostname}:${port} - ${err.message}`,
        );
        clientSocket.end("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      });

      clientSocket.on("error", (err) => {
        console.error(`Client socket error: ${err.message}`);
      });
    });
  }

  async stop(): Promise<void> {
    console.log("Gracefully shutting down Proxx...");

    const metrics = this.metricsService.getAllMetrics();
    console.log("Total Metrics:", JSON.stringify(metrics, null, 2));
    this.server?.close();
  }
}
