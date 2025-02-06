export interface Metrics {
  bandwidth_usage: string;
  top_sites: Array<{
    url: string;
    visits: number;
  }>;
}

export interface ProxyDBRecord {
  visits: number;
  bytesTransferred: number;
}

export interface AuthDBRecord {
  passwordHash: string;
}
