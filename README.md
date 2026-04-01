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

### OpenClaw Inbound (new)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/openclaw/inbound/health` | Health check for OpenClaw ingest API |
| POST | `/api/openclaw/inbound` | Receive inbound message from OpenClaw/OpenZalo and run OCR pipeline |

Current post-OCR flow:
1. Save OCR result into `zalo_forwarder.OcrResult` with `status=pending`
2. Notify owner on Telegram with Confirm/Reject buttons
3. Immediately upsert a record into `unicon_schedule` (`fuel_logs` / `repair_logs`) with `status='pending'`
4. Save back-link on `OcrResult` (`writtenToDb=true`, `fuelLogId`/`repairLogId`)

When owner confirms/rejects in Telegram, the same record can be updated by status flow.

Recommended runtime mode now (API-only receiver):

- `ENABLE_ZALO_WS_LISTENER=false` (disable internal Zalo WS listener)
- `TELEGRAM_ENABLE_POLLING=false` (disable internal Telegram getUpdates polling)

This avoids duplicate listeners/conflicts because OpenClaw + openzalo now handle realtime inbound and forward to this API.

`POST /api/openclaw/inbound` body (example):

```json
{
  "messageId": "ozl-1775037871088",
  "groupId": "2261790224946437458",
  "groupName": "Test group sửa chữa",
  "senderId": "97907894071606122",
  "senderName": "Nguyễn Văn A",
  "text": "đây là phiếu sửa chữa",
  "images": [
    "https://photo-stal-11.zdn.vn/gr/jpg/...."
  ],
  "timestamp": 1775037871088
}
```

Auth header (optional but recommended):

- `Authorization: Bearer <OPENCLAW_INBOUND_TOKEN>`
- or `x-openclaw-token: <OPENCLAW_INBOUND_TOKEN>`

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
