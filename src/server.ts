import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import http from "http";
import net from "net";
import { URL } from "url";

import { MetricsService } from "./services/metrics-service";
import { AuthService } from "./services/auth-service";
import { DatabaseService } from "./services/database-service";

export class ProxyServer {
  private readonly app: express.Application;
  private server: http.Server;
  private readonly dbService: DatabaseService;
  private readonly metricsService: MetricsService;
  private authService: AuthService;

  constructor(private port: number) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.dbService = new DatabaseService();
    this.metricsService = new MetricsService(this.dbService);
    this.authService = new AuthService(this.dbService);
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use(async (req, res, next): Promise<any> => {
      console.log("GETTING TO AUTHENTICATION");
      const authHeader = req.headers["proxy-authorization"];

      if (!authHeader) {
        res.setHeader("Proxy-Authenticate", "Basic");
        return res.status(407).send("Proxy Authentication Required");
      }

      const isAuthenticated = await this.authService.authenticate(authHeader);
      if (!isAuthenticated) {
        return res.status(403).send("Invalid credentials");
      }

      next();
    });

    this.app.get("/metrics", (req, res) => {
      const metrics = this.metricsService.getAllMetrics();
      res.json(metrics);
    });

    const proxyMiddleware = createProxyMiddleware({
      target: "https://example.com",
      router: (req) => {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const protocol = url.protocol;
        const host = url.hostname;

        console.log(`Proxying request to: ${req.url}`);

        if (protocol === "https:") {
          return {
            protocol: "https:",
            host,
          };
        }
        return req.url;
      },
      changeOrigin: true,
      secure: false,
      ws: true,
      // ssl: false,
      on: {
        proxyRes: (proxyRes, req, res) => {
          const url = new URL(req.url || "", `http://${req.headers.host}`)
            .hostname;
          let bytes = 0;
          proxyRes.on("data", (chunk) => {
            bytes += chunk.length;
          });
          proxyRes.on("end", async () => {
            await this.metricsService.updateMetrics(url, bytes);
          });
        },
      },
    });

    this.app.use("/", proxyMiddleware);
  }

  async start(): Promise<void> {
    await this.dbService.initialize();
    await this.authService.initialize();

    this.server = this.app.listen(this.port, () => {
      console.log(`Proxx is running on port ${this.port}`);
    });

    // Handle HTTPS tunneling (CONNECT requests)
    this.server.on("connect", async (req, clientSocket, head) => {
      const authHeader = req.headers["proxy-authorization"];

      if (!authHeader) {
        clientSocket.end("HTTP/1.1 407 Proxy Authentication Required \r\n\r\n");
        return;
      }

      const isAuthenticated = await this.authService.authenticate(authHeader);
      if (!isAuthenticated) {
        clientSocket.end("HTTP/1.1 403 Invalid credentials \r\n\r\n");
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
