import { Metrics, ProxyDBRecord } from "../../types";
import { IDatabaseService } from "../database-service";

export class MetricsService {
  private readonly databaseService: IDatabaseService;
  private readonly defaultMetricRecord: ProxyDBRecord = {
    visits: 0,
    bytesTransferred: 0,
  };

  constructor(databaseService: IDatabaseService) {
    this.databaseService = databaseService;
  }

  async updateMetrics(url: string, bytes: number): Promise<void> {
    const metrics = this.databaseService.getData().metrics;
    const record = metrics[url] || this.defaultMetricRecord;
    record.visits += 1;
    record.bytesTransferred += bytes;
    metrics[url] = record;

    await this.databaseService.save({ metrics });
  }

  getAllMetrics(): Metrics {
    const dbMetrics = this.databaseService.getData().metrics;
    let totalBytes = 0;
    const sites: Record<string, number> = {};

    for (const [url, record] of Object.entries(dbMetrics)) {
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
