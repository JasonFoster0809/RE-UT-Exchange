import os
import logging
import re
import uuid
from datetime import datetime

# Thêm thư viện xử lý file
from werkzeug.utils import secure_filename 

# optional: load .env if python-dotenv installed
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

from flask import Flask, request, jsonify, abort, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

from db import get_db, close_db, init_db
from auth import create_token, require_auth, require_role

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("BK_Exchange")

# Cấu hình thư mục upload
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_app():
    # Cấu hình serve file static
    app = Flask(__name__, static_folder='static')
    app.config["JSON_SORT_KEYS"] = False
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    
    cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    CORS(app, resources={r"/api/*": {"origins": [o.strip() for o in cors_origins if o.strip()]}})

    app.teardown_appcontext(close_db)
    
    with app.app_context():
        init_db(app)
        db = get_db()
        db.execute("CREATE TABLE IF NOT EXISTS wishlist (user_id INTEGER, item_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, item_id))")
        db.commit()

    def validate_text(text, max_len=1000, field_name="field"):
        if not text: return ""
        clean = str(text).strip()
        if len(clean) > max_len: abort(400, f"{field_name} quá dài")
        if "<script>" in clean.lower(): abort(400, "Phát hiện nội dung không an toàn")
        return clean

    @app.get("/api/health")
    def health(): return jsonify({"ok": True, "version": "4.2-Camera"})

    # --- API UPLOAD ẢNH MỚI ---
    @app.post("/api/upload")
    def upload_file():
        if 'file' not in request.files:
            return jsonify({"error": "Không có file"}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "Chưa chọn file"}), 400
        if file and allowed_file(file.filename):
            # Tạo tên file độc nhất để tránh trùng
            ext = file.filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{uuid.uuid4().hex}.{ext}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
            
            # Trả về URL đầy đủ (Lưu ý: chỉnh port 5000 nếu chạy local)
            host_url = request.host_url.rstrip('/') 
            full_url = f"{host_url}/static/uploads/{unique_filename}"
            return jsonify({"url": full_url})
        
        return jsonify({"error": "File không hợp lệ (chỉ nhận ảnh)"}), 400
    # --------------------------

    @app.post("/api/auth/register")
    def register():
        data = request.get_json(force=True)
        full_name = validate_text(data.get("full_name"), 100)
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email): return jsonify({"error": "Email không hợp lệ"}), 400
        if not full_name or len(password) < 6: return jsonify({"error": "Thiếu thông tin hoặc pass < 6 ký tự"}), 400

        db = get_db()
        try:
            db.execute("INSERT INTO users(full_name, email, password_hash) VALUES(?,?,?)", (full_name, email, generate_password_hash(password)))
            db.commit()
        except: return jsonify({"error": "Email đã tồn tại"}), 409
        user = db.execute("SELECT id, full_name, email, role FROM users WHERE email=?", (email,)).fetchone()
        return jsonify({"token": create_token(user["id"], user["email"], user["full_name"], user["role"]), "user": dict(user)})

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(force=True)
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if not user or not check_password_hash(user["password_hash"], password): return jsonify({"error": "Sai thông tin"}), 401
        
        if email == "khang.dokhang210@hcmut.edu.vn" and user["role"] != "admin":
            db.execute("UPDATE users SET role='admin' WHERE id=?", (user["id"],))
            db.commit()
            user = db.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
            
        return jsonify({"token": create_token(user["id"], user["email"], user["full_name"], user["role"]), "user": {"id": user["id"], "full_name": user["full_name"], "email": user["email"], "role": user["role"]}})

    @app.get("/api/me")
    @require_auth
    def me():
        user = get_db().execute("SELECT id, full_name, email, role FROM users WHERE id=?", (int(request.user["sub"]),)).fetchone()
        if not user: return jsonify({"error": "User not found"}), 404
        return jsonify({"user": dict(user)})

    @app.put("/api/me")
    @require_auth
    def update_me():
        data = request.get_json(force=True)
        full_name = validate_text(data.get("full_name"), 100)
        if not full_name: return jsonify({"error": "Tên không hợp lệ"}), 400
        db = get_db()
        db.execute("UPDATE users SET full_name=? WHERE id=?", (full_name, int(request.user["sub"])))
        db.commit()
        user = db.execute("SELECT id, full_name, email, role FROM users WHERE id=?", (int(request.user["sub"]),)).fetchone()
        return jsonify({"user": dict(user)})

    @app.get("/api/items")
    def list_items():
        q = validate_text(request.args.get("q"), 100)
        item_type = validate_text(request.args.get("type"), 20)
        mode = validate_text(request.args.get("mode"), 20)
        status = validate_text(request.args.get("status") or "available", 20)
        sort_by = validate_text(request.args.get("sort"), 20)
        min_price = request.args.get("min_price")
        max_price = request.args.get("max_price")

        db = get_db()
        sql = """SELECT i.*, u.full_name AS owner_name,
                 (SELECT COUNT(*) FROM swap_requests WHERE (requester_id=u.id OR item_id IN (SELECT id FROM items WHERE owner_id=u.id)) AND status='completed') as completed_swaps
                 FROM items i JOIN users u ON u.id=i.owner_id
                 WHERE i.status=?"""
        params = [status]

        if item_type: sql += " AND i.type=?"; params.append(item_type)
        if mode: sql += " AND i.exchange_mode=?"; params.append(mode)
        if q:
            sql += " AND (lower(i.title) LIKE ? OR lower(i.description) LIKE ? OR lower(i.category) LIKE ?)"
            like = f"%{q.lower()}%"; params.extend([like, like, like])
        
        if min_price and min_price.isdigit(): sql += " AND (i.price >= ? OR i.price IS NULL)"; params.append(int(min_price))
        if max_price and max_price.isdigit(): sql += " AND (i.price <= ? OR i.price IS NULL)"; params.append(int(max_price))

        if sort_by == 'price_asc': sql += " ORDER BY i.price ASC, i.created_at DESC"
        elif sort_by == 'price_desc': sql += " ORDER BY i.price DESC, i.created_at DESC"
        elif sort_by == 'old': sql += " ORDER BY i.created_at ASC"
        else: sql += " ORDER BY i.created_at DESC"

        sql += " LIMIT 200"
        rows = db.execute(sql, params).fetchall()
        
        items = []
        for r in rows:
            it = dict(r)
            it['is_trusted'] = it['completed_swaps'] >= 3
            items.append(it)
        return jsonify({"items": items})

    @app.post("/api/items")
    @require_auth
    def create_item():
        data = request.get_json(force=True)
        title = validate_text(data.get("title"), 200)
        if not title: return jsonify({"error": "Tiêu đề bắt buộc"}), 400
        db = get_db()
        db.execute("INSERT INTO items(owner_id, type, title, description, category, condition, exchange_mode, price, image_url) VALUES(?,?,?,?,?,?,?,?,?)",
            (int(request.user["sub"]), data.get("type"), title, validate_text(data.get("description"),2000), validate_text(data.get("category"),50), data.get("condition"), data.get("exchange_mode"), data.get("price"), validate_text(data.get("image_url"),500)))
        db.commit()
        return jsonify({"ok": True}), 201

    @app.put("/api/items/<int:item_id>")
    @require_auth
    def update_item(item_id):
        data = request.get_json(force=True)
        db = get_db()
        item = db.execute("SELECT owner_id FROM items WHERE id=?", (item_id,)).fetchone()
        if not item: return jsonify({"error": "Not found"}), 404
        if int(item["owner_id"]) != int(request.user["sub"]): return jsonify({"error": "Forbidden"}), 403
        fields = ["title","description","category","condition","exchange_mode","price","image_url","type"]
        updates = {k: validate_text(str(data.get(k))) for k in fields if k in data}
        if updates:
            sets = ", ".join([f"{k}=?" for k in updates.keys()])
            db.execute(f"UPDATE items SET {sets} WHERE id=?", list(updates.values()) + [item_id])
            db.commit()
        return jsonify({"ok": True})

    @app.delete("/api/items/<int:item_id>")
    @require_auth
    def delete_item(item_id):
        db = get_db()
        item = db.execute("SELECT owner_id FROM items WHERE id=?", (item_id,)).fetchone()
        if not item or int(item["owner_id"]) != int(request.user["sub"]): return jsonify({"error": "Forbidden"}), 403
        db.execute("DELETE FROM items WHERE id=?", (item_id,))
        db.commit()
        return jsonify({"ok": True})

    @app.get("/api/wishlist")
    @require_auth
    def get_wishlist():
        rows = get_db().execute("SELECT item_id FROM wishlist WHERE user_id=?", (int(request.user["sub"]),)).fetchall()
        return jsonify({"ids": [r["item_id"] for r in rows]})

    @app.post("/api/wishlist/<int:item_id>")
    @require_auth
    def toggle_wishlist(item_id):
        user_id = int(request.user["sub"])
        db = get_db()
        exist = db.execute("SELECT 1 FROM wishlist WHERE user_id=? AND item_id=?", (user_id, item_id)).fetchone()
        if exist: db.execute("DELETE FROM wishlist WHERE user_id=? AND item_id=?", (user_id, item_id))
        else: db.execute("INSERT INTO wishlist(user_id, item_id) VALUES(?,?)", (user_id, item_id))
        db.commit()
        return jsonify({"ok": True})

    @app.post("/api/swaps")
    @require_auth
    def create_swap():
        data = request.get_json(force=True)
        item_id = data.get("item_id")
        msg = validate_text(data.get("message"), 500)
        if not item_id: return jsonify({"error": "Thiếu item_id"}), 400
        db = get_db()
        item = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
        if not item or item["status"]!='available': return jsonify({"error": "Item không khả dụng"}), 400
        if int(item["owner_id"]) == int(request.user["sub"]): return jsonify({"error": "Không thể tự swap"}), 400
        existing = db.execute("SELECT id FROM swap_requests WHERE requester_id=? AND item_id=? AND status='pending'", (int(request.user["sub"]), item_id)).fetchone()
        if not existing:
            db.execute("INSERT INTO swap_requests(requester_id, item_id, message) VALUES(?,?,?)", (int(request.user["sub"]), item_id, msg))
            db.commit()
            swap_id = db.execute("SELECT last_insert_rowid() as id").fetchone()['id']
            db.execute("INSERT INTO messages(swap_request_id, sender_id, body) VALUES(?,?,?)", (swap_id, int(request.user["sub"]), msg))
            db.commit()
        return jsonify({"ok": True}), 201

    @app.get("/api/chat/conversations")
    @require_auth
    def get_conversations():
        uid = int(request.user["sub"])
        db = get_db()
        sql = """
            SELECT DISTINCT 
                CASE WHEN s.requester_id = ? THEN u_owner.id ELSE u_req.id END as partner_id,
                CASE WHEN s.requester_id = ? THEN u_owner.full_name ELSE u_req.full_name END as partner_name
            FROM swap_requests s
            JOIN items i ON s.item_id = i.id
            JOIN users u_owner ON i.owner_id = u_owner.id
            JOIN users u_req ON s.requester_id = u_req.id
            WHERE s.requester_id = ? OR i.owner_id = ?
        """
        rows = db.execute(sql, (uid, uid, uid, uid, uid)).fetchall()
        conversations = []
        for r in rows:
            partner_id = r['partner_id']
            last_msg = db.execute("""
                SELECT m.body, m.created_at 
                FROM messages m
                JOIN swap_requests s ON m.swap_request_id = s.id
                JOIN items i ON s.item_id = i.id
                WHERE (s.requester_id = ? AND i.owner_id = ?) OR (s.requester_id = ? AND i.owner_id = ?)
                ORDER BY m.created_at DESC LIMIT 1
            """, (uid, partner_id, partner_id, uid)).fetchone()
            
            conversations.append({
                "partner_id": partner_id,
                "partner_name": r['partner_name'],
                "last_message": last_msg['body'] if last_msg else "...",
                "last_time": last_msg['created_at'] if last_msg else ""
            })
        conversations.sort(key=lambda x: x['last_time'] or '', reverse=True)
        return jsonify({"conversations": conversations})

    @app.get("/api/chat/partner/<int:partner_id>")
    @require_auth
    def get_partner_messages(partner_id):
        uid = int(request.user["sub"])
        db = get_db()
        sql = """
            SELECT m.*, u.full_name as sender_name, i.title as item_title, s.status as swap_status
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            JOIN swap_requests s ON m.swap_request_id = s.id
            JOIN items i ON s.item_id = i.id
            WHERE (s.requester_id = ? AND i.owner_id = ?) 
               OR (s.requester_id = ? AND i.owner_id = ?)
            ORDER BY m.created_at ASC
        """
        rows = db.execute(sql, (uid, partner_id, partner_id, uid)).fetchall()
        return jsonify({"messages": [dict(r) for r in rows]})

    @app.post("/api/chat/partner/<int:partner_id>")
    @require_auth
    def send_partner_message(partner_id):
        uid = int(request.user["sub"])
        body = validate_text(request.get_json(force=True).get("body"), 1000)
        if not body: return jsonify({"error": "Empty"}), 400
        db = get_db()
        swap = db.execute("""
            SELECT s.id 
            FROM swap_requests s
            JOIN items i ON s.item_id = i.id
            WHERE ((s.requester_id = ? AND i.owner_id = ?) OR (s.requester_id = ? AND i.owner_id = ?))
            ORDER BY s.created_at DESC LIMIT 1
        """, (uid, partner_id, partner_id, uid)).fetchone()
        if not swap: return jsonify({"error": "No connection"}), 400
        db.execute("INSERT INTO messages(swap_request_id, sender_id, body) VALUES(?,?,?)", (swap['id'], uid, body))
        db.commit()
        return jsonify({"ok": True})

    @app.get("/api/swaps/mine")
    @require_auth
    def old_my_swaps():
        # Giữ lại để tương thích nếu cần, nhưng frontend mới dùng chat API
        return jsonify({"swaps": []})
        
    @app.get("/api/swaps/incoming")
    @require_auth
    def old_incoming_swaps():
        return jsonify({"swaps": []})

    # --- ADMIN (Giữ nguyên) ---
    @app.get("/api/admin/stats")
    @require_auth
    @require_role(["admin"])
    def admin_stats():
        db = get_db()
        users = db.execute("SELECT count(*) as c FROM users").fetchone()["c"]
        items = db.execute("SELECT count(*) as c FROM items").fetchone()["c"]
        swaps = db.execute("SELECT count(*) as c FROM swap_requests").fetchone()["c"]
        return jsonify({"users": users, "items": items, "swaps": swaps})
    @app.get("/api/admin/users")
    @require_auth
    @require_role(["admin"])
    def admin_list_users():
        return jsonify({"users": [dict(r) for r in get_db().execute("SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 500").fetchall()]})
    @app.put("/api/admin/users/<int:user_id>/role")
    @require_auth
    @require_role(["admin"])
    def admin_set_user_role(user_id):
        role = request.get_json(force=True).get("role")
        get_db().execute("UPDATE users SET role=? WHERE id=?", (role, user_id)); get_db().commit(); return jsonify({"ok": True})
    @app.get("/api/admin/items")
    @require_auth
    @require_role(["admin"])
    def admin_list_items():
        return jsonify({"items": [dict(r) for r in get_db().execute("SELECT i.*, u.full_name AS owner_name FROM items i JOIN users u ON u.id=i.owner_id ORDER BY i.created_at DESC LIMIT 500").fetchall()]})
    @app.put("/api/admin/items/<int:item_id>/status")
    @require_auth
    @require_role(["admin"])
    def admin_set_item_status(item_id):
        st = request.get_json(force=True).get("status")
        get_db().execute("UPDATE items SET status=? WHERE id=?", (st, item_id)); get_db().commit(); return jsonify({"ok": True})
    @app.get("/api/admin/swaps")
    @require_auth
    @require_role(["admin"])
    def admin_list_swaps():
        return jsonify({"swaps": [dict(r) for r in get_db().execute("SELECT s.*, i.title AS item_title, uo.full_name AS owner_name FROM swap_requests s JOIN items i ON i.id=s.item_id JOIN users uo ON uo.id=i.owner_id ORDER BY s.created_at DESC LIMIT 500").fetchall()]})

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)