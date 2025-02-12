#!/usr/bin/env node

import "dotenv/config";
import { Proxx } from "./server";

const command = process.argv[2];
const port = parseInt(process.argv[3]) || 3000;
let proxyServer: Proxx;

export async function initProxy() {
  switch (command) {
    case "start":
      console.log(`Starting Proxx...`);
      proxyServer = new Proxx(port);
      await proxyServer.start();

      process.on("SIGINT", async () => {
        await proxyServer.stop();
        process.exit(0);
      });
      break;
    default:
      console.log("Usage: proxx [start <port>]");
      process.exit(1);
  }
}
