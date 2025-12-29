# DỰ ÁN: WEB TRAO ĐỔI SÁCH / DỤNG CỤ HỌC TẬP (MVP)

## Chạy local
### Backend
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
npm i
npm run dev
```

## Có gì sẵn
- Đăng ký / đăng nhập (JWT)
- Đăng món đồ: book/tool
- Lọc + tìm kiếm đồ available
- Gửi yêu cầu trao đổi
- Chủ đồ Accept/Reject/Completed; người gửi Cancel
- Chat đơn giản theo từng yêu cầu
