# Zalo Forwarder

Zalo message forwarder with WebSocket listener and webhook delivery.

## Quick Start

```bash
# Install dependencies
npm install

# Setup database
cp .env.example .env
# Edit .env with your database URL
npx prisma migrate dev

# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Auth (QR Login)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/qr/generate` | Generate QR code for login |
| POST | `/api/auth/qr/wait-scan` | Poll for QR scan status |
| POST | `/api/auth/qr/wait-confirm` | Poll for user confirmation |
| POST | `/api/auth/qr/complete` | Complete login flow |
| POST | `/api/auth/disconnect/:id` | Disconnect account |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |

## Login Flow

1. **Generate QR**: `POST /api/auth/qr/generate` → returns `{ accountId, image, code, token }`
2. **Wait Scan**: `POST /api/auth/qr/wait-scan` with `{ accountId, code }` → poll until `status: "scanned"`
3. **Wait Confirm**: `POST /api/auth/qr/wait-confirm` with `{ accountId, code }` → user confirms on phone
4. **Complete**: `POST /api/auth/qr/complete` with `{ accountId, code }` → finalize login, get zpw_enk

## Tech Stack

- **Runtime**: Node.js 22 + TypeScript (strict mode)
- **Framework**: Express.js
- **Database**: PostgreSQL 16 + Prisma 5
- **Port**: 3002
