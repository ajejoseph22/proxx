# **Proxx**

A lightweight **proxy server** that supports **basic authentication**, **bandwidth tracking**, and **site analytics**. It works with both **HTTP & HTTPS** traffic and provides real-time metrics via an endpoint.

## **Features**

- 🔑 **Basic Authentication** using username/password
- 📊 **Bandwidth Tracking** (data sent/received)
- 📈 **Site Analytics** (aggregated statistics)
- 🚀 **Real-time Metrics** for live analytics
- 🔄 **Graceful Shutdown** showing total usage statistics

---

## **Installation**

### **Prerequisites**

- Node.js (v18+ recommended)
- npm or yarn

### **Install via npm**

You can install Proxx directly via npm:

```bash
npm install -g @ajejoseph22/proxx
```

### **Using the Proxy**
1. set your admin username and password
```bash
export ADMIN_USERNAME=username
export ADMIN_PASSWORD=password
```

2. start the proxy server
```bash
proxx start <port>
```

3. configure your client to use the proxy, or use curl with authentication:

```bash
curl -x http://localhost:<port> -U username:password http://example.com
```

4. view the real-time metrics at `/metrics`:

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