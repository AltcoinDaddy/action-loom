# ActionLoom Deployment Guide

This guide covers deploying ActionLoom to various environments, from development to production.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Environment Configuration](#environment-configuration)
3. [Local Development](#local-development)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Cloud Platforms](#cloud-platforms)
8. [Database Setup](#database-setup)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Security Configuration](#security-configuration)
11. [Performance Optimization](#performance-optimization)
12. [Troubleshooting](#troubleshooting)

## Deployment Overview

ActionLoom can be deployed in several configurations:

### Deployment Architectures

#### Single Server (Development/Small Scale)
```
┌─────────────────────────────────────┐
│           Single Server             │
│  ┌─────────────┐ ┌─────────────────┐│
│  │   Next.js   │ │  WebSocket      ││
│  │   App       │ │  Server         ││
│  └─────────────┘ └─────────────────┘│
│  ┌─────────────────────────────────┐ │
│  │        Database (Optional)      │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### Distributed (Production Scale)
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   CDN/      │    │  Load       │    │  App        │
│   Static    │    │  Balancer   │    │  Servers    │
│   Assets    │    │             │    │  (Multiple) │
└─────────────┘    └─────────────┘    └─────────────┘
                           │                   │
                           └───────────────────┘
                                      │
                   ┌─────────────────────────────────┐
                   │                                 │
            ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
            │  Database   │  │  WebSocket  │  │   Cache     │
            │  Cluster    │  │  Servers    │  │   Layer     │
            └─────────────┘  └─────────────┘  └─────────────┘
```

### Supported Platforms

- **Vercel** (Recommended for Next.js)
- **Netlify** (Static deployment)
- **AWS** (EC2, ECS, Lambda)
- **Google Cloud Platform** (Cloud Run, Compute Engine)
- **Azure** (App Service, Container Instances)
- **DigitalOcean** (App Platform, Droplets)
- **Railway** (Simple deployment)
- **Self-hosted** (Docker, bare metal)

## Environment Configuration

### Environment Variables

Create environment files for each deployment stage:

#### `.env.local` (Development)
```env
# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_TELEMETRY_DISABLED=1

# Flow Network
NEXT_PUBLIC_FLOW_NETWORK=testnet
NEXT_PUBLIC_FLOW_ACCESS_API=https://rest-testnet.onflow.org
NEXT_PUBLIC_FLOW_DISCOVERY_WALLET=https://fcl-discovery.onflow.org/testnet/authn

# WebSocket Server
WEBSOCKET_PORT=8080
WEBSOCKET_HOST=localhost
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8080

# API Keys (Optional)
HUGGINGFACE_API_KEY=your_development_key
ACTIONLOOM_API_KEY=your_development_api_key

# Database (Optional)
DATABASE_URL=postgresql://user:password@localhost:5432/actionloom_dev

# Security
NEXTAUTH_SECRET=your-development-secret
NEXTAUTH_URL=http://localhost:3000

# Monitoring (Optional)
SENTRY_DSN=your_sentry_dsn
ANALYTICS_ID=your_analytics_id
```

#### `.env.staging` (Staging)
```env
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://staging.actionloom.com

# Flow Network
NEXT_PUBLIC_FLOW_NETWORK=testnet
NEXT_PUBLIC_FLOW_ACCESS_API=https://rest-testnet.onflow.org
NEXT_PUBLIC_FLOW_DISCOVERY_WALLET=https://fcl-discovery.onflow.org/testnet/authn

# WebSocket Server
WEBSOCKET_PORT=8080
WEBSOCKET_HOST=0.0.0.0
NEXT_PUBLIC_WEBSOCKET_URL=wss://staging-ws.actionloom.com

# API Keys
HUGGINGFACE_API_KEY=your_staging_key
ACTIONLOOM_API_KEY=your_staging_api_key

# Database
DATABASE_URL=postgresql://user:password@staging-db.actionloom.com:5432/actionloom_staging

# Security
NEXTAUTH_SECRET=your-staging-secret
NEXTAUTH_URL=https://staging.actionloom.com

# Monitoring
SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=staging
```

#### `.env.production` (Production)
```env
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://actionloom.com

# Flow Network
NEXT_PUBLIC_FLOW_NETWORK=mainnet
NEXT_PUBLIC_FLOW_ACCESS_API=https://rest-mainnet.onflow.org
NEXT_PUBLIC_FLOW_DISCOVERY_WALLET=https://fcl-discovery.onflow.org/authn

# WebSocket Server
WEBSOCKET_PORT=8080
WEBSOCKET_HOST=0.0.0.0
NEXT_PUBLIC_WEBSOCKET_URL=wss://ws.actionloom.com

# API Keys
HUGGINGFACE_API_KEY=your_production_key
ACTIONLOOM_API_KEY=your_production_api_key

# Database
DATABASE_URL=postgresql://user:password@prod-db.actionloom.com:5432/actionloom_prod

# Security
NEXTAUTH_SECRET=your-production-secret
NEXTAUTH_URL=https://actionloom.com

# Monitoring
SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=production
```

### Configuration Validation

Create a configuration validator:

```typescript
// lib/config.ts
import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_FLOW_NETWORK: z.enum(['testnet', 'mainnet']),
  DATABASE_URL: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
})

export const config = configSchema.parse(process.env)
```

## Local Development

### Quick Start

```bash
# Clone and setup
git clone https://github.com/your-org/actionloom.git
cd actionloom
pnpm install

# Environment setup
cp .env.example .env.local
# Edit .env.local with your values

# Start development servers
pnpm run dev:full
```

### Development Services

#### Next.js Development Server
```bash
# Start Next.js with hot reload
pnpm dev

# Custom port
PORT=3001 pnpm dev

# Debug mode
DEBUG=* pnpm dev
```

#### WebSocket Server
```bash
# Start WebSocket server
pnpm run dev:ws

# Custom port
WEBSOCKET_PORT=8081 pnpm run dev:ws

# Debug mode
DEBUG=ws pnpm run dev:ws
```

#### Database (Optional)
```bash
# Start PostgreSQL with Docker
docker run --name actionloom-db \
  -e POSTGRES_DB=actionloom_dev \
  -e POSTGRES_USER=actionloom \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# Run migrations
pnpm run db:migrate

# Seed development data
pnpm run db:seed
```

## Staging Deployment

### Vercel Staging

1. **Connect Repository**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login and link project
   vercel login
   vercel link
   ```

2. **Configure Environment Variables**
   ```bash
   # Set staging environment variables
   vercel env add NEXT_PUBLIC_FLOW_NETWORK staging
   vercel env add DATABASE_URL staging
   vercel env add NEXTAUTH_SECRET staging
   ```

3. **Deploy to Staging**
   ```bash
   # Deploy staging branch
   vercel --prod --target staging
   
   # Or use GitHub integration
   git push origin staging
   ```

### Manual Staging Setup

1. **Server Preparation**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install pnpm
   npm install -g pnpm
   
   # Install PM2 for process management
   npm install -g pm2
   ```

2. **Application Deployment**
   ```bash
   # Clone repository
   git clone https://github.com/your-org/actionloom.git
   cd actionloom
   
   # Install dependencies
   pnpm install
   
   # Build application
   pnpm build
   
   # Start with PM2
   pm2 start ecosystem.config.js --env staging
   ```

3. **PM2 Configuration**
   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [
       {
         name: 'actionloom-app',
         script: 'npm',
         args: 'start',
         env: {
           NODE_ENV: 'production',
           PORT: 3000
         },
         env_staging: {
           NODE_ENV: 'production',
           PORT: 3000,
           NEXT_PUBLIC_FLOW_NETWORK: 'testnet'
         }
       },
       {
         name: 'actionloom-ws',
         script: 'lib/websocket-server.mjs',
         env: {
           WEBSOCKET_PORT: 8080
         }
       }
     ]
   }
   ```

## Production Deployment

### Vercel Production (Recommended)

1. **Production Configuration**
   ```bash
   # Set production environment variables
   vercel env add NEXT_PUBLIC_FLOW_NETWORK production
   vercel env add NEXT_PUBLIC_FLOW_ACCESS_API production
   vercel env add DATABASE_URL production
   vercel env add NEXTAUTH_SECRET production
   ```

2. **Custom Domain Setup**
   ```bash
   # Add custom domain
   vercel domains add actionloom.com
   vercel domains add www.actionloom.com
   
   # Configure DNS
   # Add CNAME record: www -> cname.vercel-dns.com
   # Add A record: @ -> 76.76.19.61
   ```

3. **Deploy to Production**
   ```bash
   # Deploy main branch to production
   vercel --prod
   
   # Or use automatic deployment
   git push origin main
   ```

### AWS Production Deployment

#### Using AWS App Runner

1. **Create App Runner Service**
   ```yaml
   # apprunner.yaml
   version: 1.0
   runtime: nodejs18
   build:
     commands:
       build:
         - echo "Installing dependencies"
         - npm install -g pnpm
         - pnpm install
         - echo "Building application"
         - pnpm build
   run:
     runtime-version: 18
     command: pnpm start
     network:
       port: 3000
       env: PORT
     env:
       - name: NODE_ENV
         value: production
   ```

2. **Deploy with CLI**
   ```bash
   # Create service
   aws apprunner create-service \
     --service-name actionloom-prod \
     --source-configuration '{
       "ImageRepository": {
         "ImageIdentifier": "public.ecr.aws/aws-containers/hello-app-runner:latest",
         "ImageConfiguration": {
           "Port": "3000"
         },
         "ImageRepositoryType": "ECR_PUBLIC"
       },
       "AutoDeploymentsEnabled": true
     }'
   ```

#### Using ECS with Fargate

1. **Create Task Definition**
   ```json
   {
     "family": "actionloom-prod",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "512",
     "memory": "1024",
     "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
     "containerDefinitions": [
       {
         "name": "actionloom-app",
         "image": "your-account.dkr.ecr.region.amazonaws.com/actionloom:latest",
         "portMappings": [
           {
             "containerPort": 3000,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {
             "name": "NODE_ENV",
             "value": "production"
           }
         ],
         "logConfiguration": {
           "logDriver": "awslogs",
           "options": {
             "awslogs-group": "/ecs/actionloom-prod",
             "awslogs-region": "us-east-1",
             "awslogs-stream-prefix": "ecs"
           }
         }
       }
     ]
   }
   ```

## Docker Deployment

### Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build application
RUN npm install -g pnpm && pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/actionloom
    depends_on:
      - db
      - websocket
    restart: unless-stopped

  websocket:
    build:
      context: .
      dockerfile: Dockerfile.websocket
    ports:
      - "8080:8080"
    environment:
      - WEBSOCKET_PORT=8080
      - WEBSOCKET_HOST=0.0.0.0
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=actionloom
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  postgres_data:
```

### WebSocket Dockerfile

```dockerfile
# Dockerfile.websocket
FROM node:18-alpine

WORKDIR /app

# Copy WebSocket server files
COPY lib/websocket-server.mjs ./
COPY package.json ./

# Install only production dependencies
RUN npm install --production

EXPOSE 8080

CMD ["node", "websocket-server.mjs"]
```

### Build and Deploy

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale app=3

# Stop services
docker-compose down
```

## Cloud Platforms

### Google Cloud Platform

#### Cloud Run Deployment

1. **Build and Push Image**
   ```bash
   # Configure Docker for GCP
   gcloud auth configure-docker
   
   # Build and tag image
   docker build -t gcr.io/your-project/actionloom .
   
   # Push to Container Registry
   docker push gcr.io/your-project/actionloom
   ```

2. **Deploy to Cloud Run**
   ```bash
   # Deploy service
   gcloud run deploy actionloom \
     --image gcr.io/your-project/actionloom \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars NODE_ENV=production
   ```

#### App Engine Deployment

```yaml
# app.yaml
runtime: nodejs18

env_variables:
  NODE_ENV: production
  NEXT_PUBLIC_FLOW_NETWORK: mainnet

automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.6
```

```bash
# Deploy to App Engine
gcloud app deploy
```

### Azure Deployment

#### Container Instances

```bash
# Create resource group
az group create --name actionloom-rg --location eastus

# Create container instance
az container create \
  --resource-group actionloom-rg \
  --name actionloom-app \
  --image your-registry/actionloom:latest \
  --dns-name-label actionloom \
  --ports 3000 \
  --environment-variables NODE_ENV=production
```

#### App Service

```bash
# Create App Service plan
az appservice plan create \
  --name actionloom-plan \
  --resource-group actionloom-rg \
  --sku B1 \
  --is-linux

# Create web app
az webapp create \
  --resource-group actionloom-rg \
  --plan actionloom-plan \
  --name actionloom-app \
  --deployment-container-image-name your-registry/actionloom:latest
```

### DigitalOcean App Platform

```yaml
# .do/app.yaml
name: actionloom
services:
- name: web
  source_dir: /
  github:
    repo: your-org/actionloom
    branch: main
  run_command: pnpm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: NEXT_PUBLIC_FLOW_NETWORK
    value: mainnet
  http_port: 3000
  routes:
  - path: /
```

```bash
# Deploy with CLI
doctl apps create --spec .do/app.yaml
```

## Database Setup

### PostgreSQL Setup

#### Local Development

```bash
# Using Docker
docker run --name actionloom-db \
  -e POSTGRES_DB=actionloom_dev \
  -e POSTGRES_USER=actionloom \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# Using Homebrew (macOS)
brew install postgresql
brew services start postgresql
createdb actionloom_dev
```

#### Production Setup

```sql
-- Create database and user
CREATE DATABASE actionloom_prod;
CREATE USER actionloom WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE actionloom_prod TO actionloom;

-- Create tables
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  workflow_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id VARCHAR(255),
  is_public BOOLEAN DEFAULT FALSE
);

CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id),
  status VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(255),
  result JSONB,
  error_message TEXT,
  gas_used INTEGER,
  execution_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_created_at ON workflows(created_at);
CREATE INDEX idx_executions_workflow_id ON executions(workflow_id);
CREATE INDEX idx_executions_status ON executions(status);
```

### Database Migrations

```typescript
// lib/db/migrations/001_initial.ts
export async function up(db: Database) {
  await db.sql`
    CREATE TABLE workflows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      workflow_data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      user_id VARCHAR(255),
      is_public BOOLEAN DEFAULT FALSE
    )
  `
}

export async function down(db: Database) {
  await db.sql`DROP TABLE workflows`
}
```

### Cloud Database Options

#### AWS RDS
```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier actionloom-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username actionloom \
  --master-user-password secure_password \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-12345678
```

#### Google Cloud SQL
```bash
# Create Cloud SQL instance
gcloud sql instances create actionloom-prod \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1
```

#### Supabase (Managed PostgreSQL)
```bash
# Create project via Supabase CLI
supabase projects create actionloom-prod

# Get connection string
supabase projects api-keys --project-ref your-project-ref
```

## Monitoring and Logging

### Application Monitoring

#### Sentry Integration

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filter out sensitive data
    if (event.request?.headers) {
      delete event.request.headers.authorization
    }
    return event
  }
})
```

#### Custom Logging

```typescript
// lib/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
})
```

### Infrastructure Monitoring

#### Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana

volumes:
  grafana-storage:
```

#### Health Check Endpoints

```typescript
// app/api/health/route.ts
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: await checkDatabaseHealth(),
    websocket: await checkWebSocketHealth()
  }

  return Response.json(health)
}
```

### Log Aggregation

#### ELK Stack

```yaml
# docker-compose.elk.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
```

## Security Configuration

### SSL/TLS Setup

#### Let's Encrypt with Nginx

```nginx
# /etc/nginx/sites-available/actionloom
server {
    listen 80;
    server_name actionloom.com www.actionloom.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name actionloom.com www.actionloom.com;

    ssl_certificate /etc/letsencrypt/live/actionloom.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/actionloom.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Security Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
]

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}
```

### Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
})
```

## Performance Optimization

### Caching Strategy

#### Redis Caching

```typescript
// lib/cache.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key)
    return value ? JSON.parse(value) : null
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value))
  }

  async del(key: string): Promise<void> {
    await redis.del(key)
  }
}
```

#### CDN Configuration

```typescript
// next.config.js
module.exports = {
  images: {
    domains: ['cdn.actionloom.com'],
    loader: 'custom',
    loaderFile: './lib/image-loader.js'
  },
  async headers() {
    return [
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  }
}
```

### Database Optimization

#### Connection Pooling

```typescript
// lib/db.ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export { pool }
```

#### Query Optimization

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_workflows_user_created 
ON workflows(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_executions_status_created 
ON executions(status, created_at DESC);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM workflows 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 10;
```

## Troubleshooting

### Common Deployment Issues

#### Build Failures

**Problem**: TypeScript compilation errors
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Fix type errors
pnpm run type-check
```

**Problem**: Missing environment variables
```bash
# Validate environment configuration
node -e "console.log(process.env.NODE_ENV)"

# Check required variables
node -e "
const required = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error('Missing:', missing);
  process.exit(1);
}
"
```

#### Runtime Issues

**Problem**: Database connection failures
```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
  console.log(err ? err : res.rows[0]);
  pool.end();
});
"
```

**Problem**: WebSocket connection issues
```bash
# Test WebSocket server
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8080/

# Check port availability
netstat -tulpn | grep :8080
```

### Performance Issues

#### Memory Leaks

```bash
# Monitor memory usage
node --inspect app.js

# Generate heap dump
kill -USR2 <process_id>

# Analyze with Chrome DevTools
chrome://inspect
```

#### High CPU Usage

```bash
# Profile CPU usage
node --prof app.js

# Generate report
node --prof-process isolate-*.log > profile.txt
```

### Monitoring Commands

```bash
# Check application health
curl -f http://localhost:3000/api/health

# Monitor logs
tail -f logs/combined.log

# Check process status
pm2 status
pm2 logs actionloom-app

# Monitor system resources
htop
iostat -x 1
```

### Recovery Procedures

#### Database Recovery

```bash
# Backup database
pg_dump $DATABASE_URL > backup.sql

# Restore from backup
psql $DATABASE_URL < backup.sql

# Point-in-time recovery
pg_basebackup -D /var/lib/postgresql/backup -Ft -z -P
```

#### Application Recovery

```bash
# Restart services
pm2 restart all

# Rollback deployment
git checkout previous-stable-commit
pnpm build
pm2 restart all

# Scale horizontally
docker-compose up -d --scale app=3
```

---

## Deployment Checklist

### Pre-deployment

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring setup
- [ ] Backup procedures tested

### Post-deployment

- [ ] Health checks passing
- [ ] SSL certificate valid
- [ ] Performance metrics baseline
- [ ] Error tracking configured
- [ ] Log aggregation working
- [ ] Backup verification
- [ ] Load testing completed

### Maintenance

- [ ] Regular security updates
- [ ] Database maintenance
- [ ] Log rotation configured
- [ ] Monitoring alerts setup
- [ ] Disaster recovery tested
- [ ] Performance optimization
- [ ] Capacity planning

For additional support with deployment, reach out through our [support channels](../README.md#support) or check the [troubleshooting guide](./TROUBLESHOOTING.md).

Happy deploying! 🚀