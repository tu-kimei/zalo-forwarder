/**
 * AI prompt templates for OCR extraction of Vietnamese fuel and repair invoices.
 *
 * IMPORTANT: 1 message can contain invoices for MULTIPLE vehicles
 * (e.g., đầu kéo + mooc). Return an array of extracted records.
 */

/**
 * Get fuel invoice OCR prompt.
 */
export function getFuelPrompt(imageCount: number, messageText?: string | null): string {
  const textPart = messageText ? `\nText đi kèm từ người gửi: "${messageText}"` : '';

  return `Bạn là OCR chuyên đọc phiếu đổ dầu xe tải tại Việt Nam.

Phân tích ${imageCount} hình ảnh phiếu đổ dầu / hoá đơn xăng dầu dưới đây.
Nếu có text đi kèm từ người gửi, dùng nó để bổ sung thông tin.${textPart}

Trích xuất và trả về JSON ARRAY với format SAU ĐÂY.
Mỗi phiếu/xe là 1 object trong array (1 message có thể có nhiều phiếu cho nhiều xe):

[
  {
    "licensePlate": "string - Biển số xe (format: 51D-12345 hoặc tương tự)",
    "driverName": "string | null - Tên tài xế",
    "fuelDate": "string - Ngày đổ dầu (format: YYYY-MM-DD)",
    "liters": "number - Số lít dầu",
    "unitPrice": "number - Đơn giá (VNĐ/lít)",
    "totalAmount": "number - Thành tiền (VNĐ)",
    "storeName": "string | null - Tên cửa hàng xăng dầu",
    "confidence": "number - Độ tin cậy 0.0-1.0",
    "notes": "string | null - Ghi chú đặc biệt (dữ liệu mờ, thiếu, nghi ngờ...)"
  }
]

QUY TẮC:
- Nếu có nhiều ảnh, merge dữ liệu từ tất cả ảnh nếu liên quan cùng 1 phiếu
- Nếu có nhiều phiếu (nhiều xe), trả về NHIỀU object trong array
- Nếu ảnh mờ/không đọc được field nào → set null + giảm confidence
- Nếu totalAmount ≠ liters × unitPrice → ghi note, dùng giá trị trên phiếu
- Nếu không tìm thấy hoá đơn trong ảnh → trả về array rỗng []
- CHỈ trả về JSON array, không giải thích gì thêm`;
}

/**
 * Get repair invoice OCR prompt.
 */
export function getRepairPrompt(imageCount: number, messageText?: string | null): string {
  const textPart = messageText ? `\nText đi kèm từ người gửi: "${messageText}"` : '';

  return `Bạn là OCR chuyên đọc phiếu sửa chữa xe tải tại Việt Nam.

Phân tích ${imageCount} hình ảnh phiếu sửa chữa / hoá đơn garage dưới đây.
Nếu có text đi kèm từ người gửi, dùng nó để bổ sung thông tin.${textPart}

Trích xuất và trả về JSON ARRAY với format SAU ĐÂY.
Mỗi phiếu/xe là 1 object trong array (1 message có thể có nhiều phiếu cho nhiều xe):

[
  {
    "licensePlate": "string - Biển số xe",
    "driverName": "string | null - Tên tài xế",
    "repairDate": "string - Ngày sửa (format: YYYY-MM-DD)",
    "garageName": "string | null - Tên garage",
    "garageAddress": "string | null - Địa chỉ garage",
    "items": [
      {
        "name": "string - Tên hạng mục sửa chữa",
        "quantity": "number | null",
        "unitPrice": "number | null",
        "amount": "number - Thành tiền"
      }
    ],
    "totalAmount": "number - Tổng tiền (VNĐ)",
    "km": "number | null - Số km (odometer)",
    "confidence": "number - Độ tin cậy 0.0-1.0",
    "notes": "string | null - Ghi chú đặc biệt"
  }
]

QUY TẮC:
- Nếu có nhiều ảnh, merge dữ liệu từ tất cả ảnh nếu liên quan cùng 1 phiếu
- Nếu có nhiều phiếu (nhiều xe), trả về NHIỀU object trong array
- items phải list chi tiết từng hạng mục
- Nếu chỉ có tổng tiền mà không list chi tiết → items = [{ "name": "Tổng hợp", "amount": totalAmount }]
- Nếu ảnh mờ/không đọc được field nào → set null + giảm confidence
- Nếu không tìm thấy hoá đơn trong ảnh → trả về array rỗng []
- CHỈ trả về JSON array, không giải thích gì thêm`;
}
