# Proxx

A lightweight **proxy server** that supports **basic authentication** , **bandwidth tracking** and **site analytics**. It works with both **HTTP & HTTPS** traffic and provides real-time metrics via an endpoint.

## Features

- **Basic Authentication** using username/password
- **Bandwidth Tracking** (data sent/received)
- **Site Analytics** (aggregated statistics)
- **Real-time Metrics** for real-time analytics
- **Graceful Shutdown** showing total usage statistics

## Installation

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/ajejoseph22/proxx.git
   cd proxx
    ```
2. Install dependencies:
    
   ```bash
   npm install
   ```
3. Generate an environment file:

   ```bash
   cp .env.example .env
   ```
   
4. Start the server:

   ```bash
    npm start start <port>
    ```

## Usage

1. To use the proxy, configure your client or use curl with authentication:
```bash
  curl -x http://localhost:<port> --proxy-user <your_username>:<your_password> -L http://example.com 
```

2. To view real-time metrics, visit or curl the following URL like so:
```bash
  curl -u <your_username>:<your_password> http://localhost:<port>/metrics
```

Example response
```json
{
  "bandwidth_usage": "125MB",
  "top_sites": [
    {"url": "example.com", "visits": 10},
    {"url": "google.com", "visits": 5}
  ]
}
```