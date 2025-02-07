#!/usr/bin/env node

import "dotenv/config";
import { ProxyServer } from "./server";

const command = process.argv[2];
const port = parseInt(process.argv[3]) || 3000;
let proxyServer: ProxyServer;

async function main() {
  switch (command) {
    case "start":
      console.log(`Starting Proxx...`);
      proxyServer = new ProxyServer(port);
      await proxyServer.start();

      process.on("SIGINT", async () => {
        await proxyServer.stop();
        process.exit(0);
      });
      break;
    default:
      console.log("Usage: proxx [start <port>|stop]");
      process.exit(1);
  }
}

main().catch(console.error);
