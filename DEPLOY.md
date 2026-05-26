# Hướng dẫn Deploy zalo-forwarder

## Yêu cầu hệ thống
- Ubuntu 20.04+ / Debian 11+
- Node.js >= 18
- PostgreSQL >= 14
- Git

---

## 1. Cài đặt môi trường

```bash
# Node.js (dùng nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# PostgreSQL
apt update && apt install -y postgresql postgresql-contrib git
```

---

## 2. Tạo database & user

```bash
sudo -u postgres psql <<EOF
CREATE USER unicon_user WITH PASSWORD 'Unicon@2026';
CREATE DATABASE zalo_forwarder OWNER unicon_user;
GRANT ALL PRIVILEGES ON DATABASE zalo_forwarder TO unicon_user;

-- Nếu server này cũng chạy unicon_schedule:
CREATE DATABASE unicon_schedule OWNER unicon_user;
GRANT ALL PRIVILEGES ON DATABASE unicon_schedule TO unicon_user;
EOF
```

---

## 3. Clone code

```bash
git clone https://github.com/tu-kimei/zalo-forwarder.git /opt/zalo-forwarder
cd /opt/zalo-forwarder
```

---

## 4. Cấu hình môi trường

Tạo file `.env` từ các biến sau:

```bash
cat > /opt/zalo-forwarder/.env <<EOF
NODE_ENV=production
PORT=3002

# Database
DATABASE_URL=postgresql://unicon_user:Unicon@2026@localhost:5432/zalo_forwarder

# JWT & Webhook
JWT_SECRET=your-secret-key-here
WEBHOOK_SIGNING_SECRET=your-webhook-secret-here

# Telegram
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_OWNER_CHAT_ID=your-telegram-chat-id
TELEGRAM_REMINDER_HOURS=12
TELEGRAM_ENABLE_POLLING=true

# OCR
OCR_AI_BASE_URL=http://localhost:20128/v1
OCR_AI_API_KEY=your-ocr-api-key
OCR_AI_MODELS=Free_For_OCR,thinking-combo,cc/claude-sonnet-4-6

# Storage
STORAGE_PATH=./storage/images

# OpenClaw
OPENCLAW_INBOUND_TOKEN=your-openclaw-token

# Zalo WebSocket
ENABLE_ZALO_WS_LISTENER=true
EOF
```

> **Lưu ý bảo mật:** Không commit file `.env` lên git.

---

## 5. Cài dependencies & migrate DB

```bash
cd /opt/zalo-forwarder
npm install

# Tạo Prisma client
npm run db:generate

# Chạy migration (tạo các bảng)
npx prisma migrate deploy
```

---

## 6. Tạo thư mục storage

```bash
mkdir -p /opt/zalo-forwarder/storage/images
```

---

## 7. Chạy thử (kiểm tra trước khi cài service)

```bash
cd /opt/zalo-forwarder
node --import tsx src/index.ts
```

Nếu thấy log khởi động bình thường, `Ctrl+C` rồi tiếp tục bước 8.

---

## 8. Cài systemd service

```bash
cat > /etc/systemd/system/zalo-forwarder.service <<EOF
[Unit]
Description=Zalo Forwarder - Message Listener & OCR Pipeline
After=postgresql.service network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/zalo-forwarder
ExecStart=/usr/bin/node --import tsx src/index.ts
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/zalo-forwarder/.env
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable zalo-forwarder
systemctl start zalo-forwarder
```

---

## 9. Kiểm tra

```bash
# Xem trạng thái service
systemctl status zalo-forwarder

# Xem log realtime
journalctl -u zalo-forwarder -f

# Kiểm tra port đang lắng nghe
ss -tlnp | grep 3002
```

---

## 10. Quản lý service

```bash
systemctl start zalo-forwarder    # Khởi động
systemctl stop zalo-forwarder     # Dừng
systemctl restart zalo-forwarder  # Khởi động lại
systemctl disable zalo-forwarder  # Tắt auto-start khi reboot
```

---

## Cấu trúc thư mục sau deploy

```
/opt/zalo-forwarder/
├── src/              # Source code
├── prisma/           # Schema & migrations
├── storage/images/   # Ảnh tải về từ Zalo
├── .env              # Biến môi trường (KHÔNG commit)
└── package.json
```

---

## Lưu ý

- **`unicon_schedule` DB**: Service cần connect tới DB này để sync trạng thái phiếu. Nếu deploy tách server, cần mở port PostgreSQL và cập nhật `config.ts` → `uniconDb.url`.
- **Zalo session**: Sau khi deploy lần đầu, cần đăng nhập lại Zalo qua QR (session không tự chuyển sang server mới).
- **OCR AI**: Đảm bảo `OCR_AI_BASE_URL` trỏ đúng endpoint AI đang chạy.
