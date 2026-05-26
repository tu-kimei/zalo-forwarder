# SPECS DỰ ÁN zalo-forwarder

## Mô tả tổng quan
- Forwarder nhận tin nhắn Zalo, pipelines OCR và đồng bộ dữ liệu về Telegram, OpenClaw, cơ sở dữ liệu nội bộ Unicon.
- QR login flow chuẩn Zalo qua chuỗi API generate/wait-scan/wait-confirm/complete.

## Module chính
- **auth:** Xử lý login QR Zalo, duy trì trạng thái session, ghi log ra database.
- **group:** Nhận và xử lý sự kiện group, phân loại tin nhắn theo groupId.
- **ocr:** Điều phối pipeline OCR (forward ảnh/phieu qua webhook, lưu & trigger notify).
- **listener:** Kênh tiếp nhận realtime event, forward nhanh về OpenClaw.
- **telegram:** Báo cáo kết quả OCR để xác nhận/nghiệm thu.
- **openclaw:** API nhận message từ OpenClaw, convert chuẩn hóa, trigger pipeline.

## Flow tiêu biểu
1. *Nhận message Zalo → OpenClaw inbound → Lưu OCRResult ("pending") → Notify owner (Telegram Confirm/Reject) → Upsert vào bảng nghiệp vụ → Sync trạng thái lại về Telegraph, sửa nếu Reject.*
2. *Đăng nhập Zalo bằng QR: POST generate → poll scan → poll confirm → complete → lưu cookies + zpw_enk vào DB. Nếu fail bước nào, log chi tiết lỗi ra logfile và trả về lỗi chuẩn API.*

## Tech/Infra
- Node.js, TypeScript, ExpressJS, PostgreSQL (Prisma), winston logger, ws, uuid.
- API chính: /api/openclaw/inbound & /api/auth/qr/..., health check...

---
Tạm thời mô tả dự án, sẽ tách từng module thành file specs riêng theo yêu cầu.