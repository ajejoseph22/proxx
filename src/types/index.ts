export interface Metrics {
  bandwidth_usage: string;
  top_sites: Array<{
    url: string;
    visits: number;
  }>;
}

export interface DBRecord {
  url: string;
  visits: number;
  bytesTransferred: number;
}
