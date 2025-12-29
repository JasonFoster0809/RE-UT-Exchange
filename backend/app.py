import os

# optional: load .env if python-dotenv installed; otherwise ignore
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

from db import get_db, close_db, init_db
from auth import create_token, require_auth, require_role

def create_app():
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    CORS(app, resources={r"/api/*": {"origins": [o.strip() for o in cors_origins if o.strip()]}})

    app.teardown_appcontext(close_db)
    init_db(app)

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True})

    @app.post("/api/auth/register")
    def register():
        data = request.get_json(force=True)
        full_name = (data.get("full_name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not full_name or not email or len(password) < 6:
            return jsonify({"error": "full_name, email required; password >= 6"}), 400

        db = get_db()
        try:
            db.execute(
                "INSERT INTO users(full_name, email, password_hash) VALUES(?,?,?)",
                (full_name, email, generate_password_hash(password)),
            )
            db.commit()
        except Exception:
            return jsonify({"error": "Email already exists"}), 409

        user = db.execute("SELECT id, full_name, email, role FROM users WHERE email=?", (email,)).fetchone()
        token = create_token(user["id"], user["email"], user["full_name"], user["role"])
        return jsonify({"token": token, "user": dict(user)})

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(force=True)
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        db = get_db()
        user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Invalid credentials"}), 401

        token = create_token(user["id"], user["email"], user["full_name"], user["role"])
        return jsonify({"token": token, "user": {"id": user["id"], "full_name": user["full_name"], "email": user["email"], "role": user["role"]}})

    @app.get("/api/me")
    @require_auth
    def me():
        return jsonify({"user": request.user})

    @app.get("/api/items")
    def list_items():
        q = (request.args.get("q") or "").strip().lower()
        item_type = (request.args.get("type") or "").strip()
        mode = (request.args.get("mode") or "").strip()
        status = (request.args.get("status") or "available").strip()

        db = get_db()
        sql = """SELECT i.*, u.full_name AS owner_name
                 FROM items i JOIN users u ON u.id=i.owner_id
                 WHERE i.status=?"""
        params = [status]

        if item_type:
            sql += " AND i.type=?"
            params.append(item_type)
        if mode:
            sql += " AND i.exchange_mode=?"
            params.append(mode)
        if q:
            sql += " AND (lower(i.title) LIKE ? OR lower(i.description) LIKE ? OR lower(i.category) LIKE ?)"
            like = f"%{q}%"
            params.extend([like, like, like])

        sql += " ORDER BY i.created_at DESC LIMIT 200"
        rows = db.execute(sql, params).fetchall()
        return jsonify({"items": [dict(r) for r in rows]})

    @app.get("/api/items/<int:item_id>")
    def get_item(item_id: int):
        db = get_db()
        row = db.execute(
            """SELECT i.*, u.full_name AS owner_name, u.email AS owner_email
                 FROM items i JOIN users u ON u.id=i.owner_id
                 WHERE i.id=?""",
            (item_id,),
        ).fetchone()
        if not row:
            return jsonify({"error": "Not found"}), 404
        return jsonify({"item": dict(row)})

    @app.post("/api/items")
    @require_auth
    def create_item():
        data = request.get_json(force=True)
        required = ["type", "title", "exchange_mode"]
        if any(not (data.get(k) or "").strip() for k in required):
            return jsonify({"error": "type, title, exchange_mode are required"}), 400

        owner_id = int(request.user["sub"])
        db = get_db()
        db.execute(
            """INSERT INTO items(owner_id, type, title, description, category, condition, exchange_mode, price, image_url)
                 VALUES(?,?,?,?,?,?,?,?,?)""",
            (
                owner_id,
                data.get("type"),
                data.get("title"),
                data.get("description"),
                data.get("category"),
                data.get("condition"),
                data.get("exchange_mode"),
                data.get("price"),
                data.get("image_url"),
            ),
        )
        db.commit()
        item = db.execute("SELECT * FROM items WHERE id=last_insert_rowid()").fetchone()
        return jsonify({"item": dict(item)}), 201

    @app.put("/api/items/<int:item_id>")
    @require_auth
    def update_item(item_id: int):
        data = request.get_json(force=True)
        db = get_db()
        item = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
        if not item:
            return jsonify({"error": "Not found"}), 404
        if int(item["owner_id"]) != int(request.user["sub"]):
            return jsonify({"error": "Forbidden"}), 403

        fields = ["title","description","category","condition","exchange_mode","price","status","image_url","type"]
        updates = {k: data.get(k) for k in fields if k in data}
        if not updates:
            return jsonify({"error": "Nothing to update"}), 400

        sets = ", ".join([f"{k}=?" for k in updates.keys()])
        params = list(updates.values()) + [item_id]
        db.execute(f"UPDATE items SET {sets} WHERE id=?", params)
        db.commit()
        item2 = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
        return jsonify({"item": dict(item2)})

    @app.delete("/api/items/<int:item_id>")
    @require_auth
    def delete_item(item_id: int):
        db = get_db()
        item = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
        if not item:
            return jsonify({"error": "Not found"}), 404
        if int(item["owner_id"]) != int(request.user["sub"]):
            return jsonify({"error": "Forbidden"}), 403
        db.execute("DELETE FROM items WHERE id=?", (item_id,))
        db.commit()
        return jsonify({"ok": True})

    @app.post("/api/swaps")
    @require_auth
    def create_swap():
        data = request.get_json(force=True)
        item_id = data.get("item_id")
        message = (data.get("message") or "").strip()
        if not item_id:
            return jsonify({"error": "item_id required"}), 400

        requester_id = int(request.user["sub"])
        db = get_db()
        item = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
        if not item or item["status"] != "available":
            return jsonify({"error": "Item not available"}), 400
        if int(item["owner_id"]) == requester_id:
            return jsonify({"error": "Cannot request your own item"}), 400

        db.execute(
            "INSERT INTO swap_requests(requester_id, item_id, message) VALUES(?,?,?)",
            (requester_id, item_id, message),
        )
        db.commit()
        row = db.execute("SELECT * FROM swap_requests WHERE id=last_insert_rowid()").fetchone()
        return jsonify({"swap": dict(row)}), 201

    @app.get("/api/swaps/mine")
    @require_auth
    def my_swaps():
        user_id = int(request.user["sub"])
        db = get_db()
        rows = db.execute(
            """SELECT s.*, i.title AS item_title, i.owner_id, u.full_name AS owner_name
                 FROM swap_requests s
                 JOIN items i ON i.id=s.item_id
                 JOIN users u ON u.id=i.owner_id
                 WHERE s.requester_id=?
                 ORDER BY s.created_at DESC""",
            (user_id,),
        ).fetchall()
        return jsonify({"swaps": [dict(r) for r in rows]})

    @app.get("/api/swaps/incoming")
    @require_auth
    def incoming_swaps():
        user_id = int(request.user["sub"])
        db = get_db()
        rows = db.execute(
            """SELECT s.*, i.title AS item_title, i.owner_id,
                        ur.full_name AS requester_name, ur.email AS requester_email
                 FROM swap_requests s
                 JOIN items i ON i.id=s.item_id
                 JOIN users ur ON ur.id=s.requester_id
                 WHERE i.owner_id=?
                 ORDER BY s.created_at DESC""",
            (user_id,),
        ).fetchall()
        return jsonify({"swaps": [dict(r) for r in rows]})

    @app.put("/api/swaps/<int:swap_id>/status")
    @require_auth
    def update_swap_status(swap_id: int):
        data = request.get_json(force=True)
        new_status = (data.get("status") or "").strip()
        if new_status not in ["accepted","rejected","cancelled","completed","pending"]:
            return jsonify({"error": "Invalid status"}), 400

        user_id = int(request.user["sub"])
        db = get_db()
        swap = db.execute(
            """SELECT s.*, i.owner_id AS item_owner_id, i.id AS item_id
                 FROM swap_requests s JOIN items i ON i.id=s.item_id
                 WHERE s.id=?""",
            (swap_id,),
        ).fetchone()
        if not swap:
            return jsonify({"error": "Not found"}), 404

        is_owner = int(swap["item_owner_id"]) == user_id
        is_requester = int(swap["requester_id"]) == user_id

        if new_status == "cancelled" and not is_requester:
            return jsonify({"error": "Only requester can cancel"}), 403
        if new_status in ["accepted","rejected","completed"] and not is_owner:
            return jsonify({"error": "Only owner can set this status"}), 403

        db.execute("UPDATE swap_requests SET status=? WHERE id=?", (new_status, swap_id))

        if new_status == "accepted":
            db.execute("UPDATE items SET status='reserved' WHERE id=?", (swap["item_id"],))
        if new_status == "completed":
            db.execute("UPDATE items SET status='exchanged' WHERE id=?", (swap["item_id"],))

        db.commit()
        swap2 = db.execute("SELECT * FROM swap_requests WHERE id=?", (swap_id,)).fetchone()
        return jsonify({"swap": dict(swap2)})

    @app.get("/api/swaps/<int:swap_id>/messages")
    @require_auth
    def list_messages(swap_id: int):
        user_id = int(request.user["sub"])
        db = get_db()
        swap = db.execute(
            """SELECT s.*, i.owner_id AS item_owner_id
                 FROM swap_requests s JOIN items i ON i.id=s.item_id
                 WHERE s.id=?""",
            (swap_id,),
        ).fetchone()
        if not swap:
            return jsonify({"error": "Not found"}), 404
        if user_id not in [int(swap["requester_id"]), int(swap["item_owner_id"])]:
            return jsonify({"error": "Forbidden"}), 403

        rows = db.execute(
            """SELECT m.*, u.full_name AS sender_name
                 FROM messages m JOIN users u ON u.id=m.sender_id
                 WHERE m.swap_request_id=?
                 ORDER BY m.created_at ASC""",
            (swap_id,),
        ).fetchall()
        return jsonify({"messages": [dict(r) for r in rows]})

    @app.post("/api/swaps/<int:swap_id>/messages")
    @require_auth
    def send_message(swap_id: int):
        data = request.get_json(force=True)
        body = (data.get("body") or "").strip()
        if not body:
            return jsonify({"error": "body required"}), 400

        user_id = int(request.user["sub"])
        db = get_db()
        swap = db.execute(
            """SELECT s.*, i.owner_id AS item_owner_id
                 FROM swap_requests s JOIN items i ON i.id=s.item_id
                 WHERE s.id=?""",
            (swap_id,),
        ).fetchone()
        if not swap:
            return jsonify({"error": "Not found"}), 404
        if user_id not in [int(swap["requester_id"]), int(swap["item_owner_id"])]:
            return jsonify({"error": "Forbidden"}), 403

        db.execute(
            "INSERT INTO messages(swap_request_id, sender_id, body) VALUES(?,?,?)",
            (swap_id, user_id, body),
        )
        db.commit()
        msg = db.execute("SELECT * FROM messages WHERE id=last_insert_rowid()").fetchone()
        return jsonify({"message": dict(msg)}), 201


    # ---- Admin (role=admin) ----
    @app.get("/api/admin/users")
    @require_auth
    @require_role(["admin"])
    def admin_list_users():
        db = get_db()
        rows = db.execute(
            "SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 500"
        ).fetchall()
        return jsonify({"users": [dict(r) for r in rows]})

    @app.put("/api/admin/users/<int:user_id>/role")
    @require_auth
    @require_role(["admin"])
    def admin_set_user_role(user_id: int):
        data = request.get_json(force=True)
        role = (data.get("role") or "").strip()
        if role not in ["user", "admin"]:
            return jsonify({"error": "Invalid role"}), 400
        db = get_db()
        u = db.execute("SELECT id FROM users WHERE id=?", (user_id,)).fetchone()
        if not u:
            return jsonify({"error": "Not found"}), 404
        db.execute("UPDATE users SET role=? WHERE id=?", (role, user_id))
        db.commit()
        row = db.execute("SELECT id, full_name, email, role, created_at FROM users WHERE id=?", (user_id,)).fetchone()
        return jsonify({"user": dict(row)})

    @app.get("/api/admin/items")
    @require_auth
    @require_role(["admin"])
    def admin_list_items():
        db = get_db()
        rows = db.execute(
            """SELECT i.*, u.full_name AS owner_name, u.email AS owner_email
                 FROM items i JOIN users u ON u.id=i.owner_id
                 ORDER BY i.created_at DESC LIMIT 500"""
        ).fetchall()
        return jsonify({"items": [dict(r) for r in rows]})

    @app.put("/api/admin/items/<int:item_id>/status")
    @require_auth
    @require_role(["admin"])
    def admin_set_item_status(item_id: int):
        data = request.get_json(force=True)
        status = (data.get("status") or "").strip()
        if status not in ["available", "reserved", "exchanged", "hidden"]:
            return jsonify({"error": "Invalid status"}), 400
        db = get_db()
        it = db.execute("SELECT id FROM items WHERE id=?", (item_id,)).fetchone()
        if not it:
            return jsonify({"error": "Not found"}), 404
        db.execute("UPDATE items SET status=? WHERE id=?", (status, item_id))
        db.commit()
        row = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
        return jsonify({"item": dict(row)})

    @app.get("/api/admin/swaps")
    @require_auth
    @require_role(["admin"])
    def admin_list_swaps():
        db = get_db()
        rows = db.execute(
            """SELECT s.*, i.title AS item_title,
                        uo.full_name AS owner_name, uo.email AS owner_email,
                        ur.full_name AS requester_name, ur.email AS requester_email
                 FROM swap_requests s
                 JOIN items i ON i.id=s.item_id
                 JOIN users uo ON uo.id=i.owner_id
                 JOIN users ur ON ur.id=s.requester_id
                 ORDER BY s.created_at DESC LIMIT 500"""
        ).fetchall()
        return jsonify({"swaps": [dict(r) for r in rows]})

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
