# BÁO CÁO KỸ THUẬT - THIẾT KẾ CƠ SỞ DỮ LIỆU & ĐỒNG BỘ JWT AUTHENTIK
**Dự án**: CloudPTalk V2 - Hệ sinh thái Sản phẩm
**Công nghệ sử dụng**: PostgreSQL + Drizzle ORM + Node.js (TypeScript) + Authentik (OIDC)

---

## 1. Giới thiệu & Mục tiêu
Báo cáo này tài liệu hóa toàn bộ quá trình thiết kế, triển khai cơ sở dữ liệu tầng nghiệp vụ (Business Layer Database) và dịch vụ đồng bộ thông tin tài khoản người dùng xuyên suốt hệ sinh thái sản phẩm (PTalk Assistant, Kid Mentor, Elder Kare) dựa trên giải pháp danh tính tập trung (**Unified Identity**) quản lý bởi Authentik.

Tất cả mã nguồn được thiết lập cô lập và đóng gói gọn gàng bên trong thư mục `/home/namnx/Ptalk_project/CloudPTalk/app/` để không làm ảnh hưởng đến mã nguồn Python cốt lõi của dự án gốc.

---

## 2. Thiết kế Database Schema (10 Bảng Nghiệp Vụ)
Sơ đồ quan hệ thực thể (Entity-Relationship Diagram) mô phỏng cấu trúc cơ sở dữ liệu được khởi tạo trong database `ptalk_business` trên cổng `5432`:

```mermaid
erDiagram
    users {
        uuid id PK
        text authentik_user_id UK "Khóa liên kết Authentik"
        text email UK "Dùng liên kết tài khoản"
        text phone
        text full_name
        user_role role "Enum"
        user_status status "Enum"
        timestamp created_at
        timestamp updated_at
    }
    user_relationships {
        uuid id PK
        uuid owner_id FK "users.id"
        uuid dependent_id FK "users.id"
        relationship_type relationship_type "Enum"
        timestamp created_at
    }
    product_enrollments {
        uuid id PK
        uuid user_id FK "users.id"
        product_name product_name "Enum"
        text status
        timestamp enrolled_at
        timestamp created_at
    }
    devices {
        uuid id PK
        text serial_number UK
        text firmware_version
        device_status status "Enum"
        timestamp last_seen
        uuid owner_id FK "users.id"
        uuid assigned_user_id FK "users.id"
        timestamp created_at
        timestamp updated_at
    }
    robot_configurations {
        uuid id PK
        uuid device_id FK "devices.id" UK
        text voice
        text language
        text personality
        integer volume
        uuid updated_by FK "users.id"
        timestamp updated_at
    }
    robot_conversations {
        uuid id PK
        uuid device_id FK "devices.id"
        uuid user_id FK "users.id"
        text message_content
        text response_content
        integer duration_seconds
        sentiment_type sentiment "Enum"
        timestamp created_at
    }
    learning_progress {
        uuid id PK
        uuid user_id FK "users.id" UK
        integer lessons_completed
        double_precision average_score
        jsonb strong_subjects
        jsonb weak_subjects
        integer time_spent_minutes
        timestamp last_studied_at
        timestamp updated_at
    }
    elder_medications {
        uuid id PK
        uuid user_id FK "users.id"
        text medicine_name
        text dosage
        text schedule_time
        text status
        timestamp created_at
        timestamp updated_at
    }
    medication_logs {
        uuid id PK
        uuid medication_id FK "elder_medications.id"
        timestamp taken_at
        text status
        timestamp created_at
    }
    audit_logs {
        uuid id PK
        uuid user_id FK "users.id"
        text action
        text target_type
        text target_id
        jsonb details
        timestamp created_at
    }

    users ||--o{ user_relationships : "Chủ hộ / Người giám hộ"
    users ||--o{ user_relationships : "Người phụ thuộc (Trẻ em/Người già)"
    users ||--o{ product_enrollments : "Đăng ký dịch vụ"
    users ||--o{ devices : "Sở hữu Robot"
    users ||--o{ devices : "Được gán Robot"
    users ||--o{ robot_conversations : "Thực hiện tương tác"
    users ||--o| learning_progress : "Tiến trình học tập (Kid Mentor)"
    users ||--o{ elder_medications : "Lịch uống thuốc (Elder Kare)"
    users ||--o{ audit_logs : "Nhật ký quản trị"
    
    devices ||--o| robot_configurations : "Cấu hình từ xa"
    devices ||--o{ robot_conversations : "Ghi nhận hội thoại"
    
    elder_medications ||--o{ medication_logs : "Nhật ký uống thuốc"
```

---

## 3. Kiến Trúc Đồng Bộ Tài Khoản JIT (Just-In-Time) từ JWT
Cơ chế đồng bộ hóa người dùng được thiết kế để tự động kích hoạt mỗi khi có yêu cầu API gửi kèm JWT Access Token từ Authentik:

1. **Giải mã & Kiểm định JWT (`app/utils/jwt.ts`)**:
   * Sử dụng thư viện `jwks-rsa` để kết nối endpoint JWKS của Authentik lấy khóa công khai.
   * Xác thực chữ ký mã hóa bằng thuật toán `RS256` (tuyệt đối chặn thuật toán `none`).
   * Kiểm tra tính hợp lệ về thời gian hết hạn (`exp`) và nhà phát hành (`iss`).
2. **Đồng bộ hóa & Provisioning Profile (`app/services/authService.ts`)**:
   * Kiểm tra xem `authentik_user_id` (`sub` claim) đã tồn tại trong bảng `users` chưa.
   * **Nếu chưa tồn tại**: Tiếp tục đối chiếu tìm kiếm theo trường `email`.
     * Nếu tìm thấy theo email, tiến hành **liên kết tài khoản** (gán `authentik_user_id` và cập nhật thông tin). Việc này giúp tự động đồng bộ hóa các tài khoản được quản trị viên/chủ hộ tạo thủ công trước đó.
     * Nếu không tìm thấy, tiến hành khởi tạo mới một bản ghi User với thông tin phân quyền vai trò (Role Mapping) tự động ánh xạ từ `groups` JWT của Authentik.
   * **Nếu đã tồn tại**: Kiểm tra các trường thông tin (`email`, `full_name`, `phone`, `role`) xem có thay đổi so với Token không, thực hiện cập nhật tự động (Upsert).

---

## 4. Kết Quả Thực Thi Thực Tế

### 4.1 Áp dụng Migrations thành công
Sau khi phân tích thiết kế, lệnh sinh migration của Drizzle Kit và áp dụng tự động (`npm run db:migrate`) đã khởi tạo thành công cấu trúc 10 bảng vào PostgreSQL:
```text
Running database migrations...
Migrations applied successfully!
```

### 4.2 Seed dữ liệu mẫu Idempotent trơn tru
Kịch bản nạp dữ liệu mẫu (`npm run db:seed`) được thiết kế tối ưu bằng cách dọn sạch dữ liệu cũ theo đúng thứ tự ràng buộc khóa ngoại trước khi nạp dữ liệu mới:
```text
Seeding ptalk_business database with mock data...
Clearing existing records to ensure seed idempotency...
Seeding users...
Seeding user relationships...
Seeding product enrollments...
Seeding devices...
Seeding configurations...
Seeding robot conversations...
Seeding learning progress...
Seeding elder medications...
Seeding medication logs...
Seeding audit logs...
Seeding completed successfully!
```

### 4.3 Vượt qua bài kiểm tra liên kết hệ thống (Integration Sync Test)
Kịch bản kiểm thử tích hợp (`npm run test:sync`) đã chạy thành công rực rỡ với các kết quả cụ thể:
1. **Kiểm thử 1 (Provisioning tài khoản mới)**: Sinh thành công bản ghi người dùng mới từ JWT Access Token giả lập.
2. **Kiểm thử 2 (Đồng bộ nâng cấp quyền)**: Khi claims của Token thay đổi (nhóm phân quyền chuyển thành `admin`), thông tin lưu trữ Postgres được tự động đồng bộ và nâng cấp vai trò thành `super_admin` tức thì.
3. **Kiểm thử 3 (Kiểm tra quan hệ liên kết thực tế)**:
   * **Quan hệ Owner <-> Dependent**: Xác định chính xác 3 mối liên kết của chủ hộ `Lê Hoàng Owner` (quản lý Bé An, Bé Chi và cụ Lê Văn Bình).
   * **Quan hệ Devices <-> Config**: Truy vấn chuẩn xác thông tin trạng thái hoạt động của 3 Robot và cấu hình giọng nói tương tác đi kèm (ví dụ: giọng đọc LISA gán cho Bé An trên Robot 001).

---

## 5. Kết luận Bảo mật (Security Audit Audit Report)
* **Chống SQL Injection**: 100% các truy vấn dữ liệu được đóng gói thành các câu lệnh tham số hóa (parameterized queries) thông qua Drizzle ORM, triệt tiêu hoàn toàn rủi ro SQLi (CWE-89).
* **Bảo mật JWT**: Triển khai cơ chế xác thực ký cứng thuật toán `RS256` và xác thực qua cổng JWKS an toàn.
* **Quản lý an toàn bí mật**: Không sử dụng thông tin đăng nhập cứng trong mã nguồn, hoàn toàn sử dụng biến môi trường (Environmental Variables) nạp từ file `.env` ở thư mục gốc dự án.
