import os
import time
import jwt
from functools import wraps
from flask import request, jsonify

def _secret() -> str:
    return os.getenv("SECRET_KEY", "dev_secret_change_me")

def create_token(user_id: int, email: str, full_name: str, role: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "name": full_name,
        "role": role,
        "iat": now,
        "exp": now + 60 * 60 * 24 * 7,
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")

def decode_token(token: str):
    return jwt.decode(token, _secret(), algorithms=["HS256"])

def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing Bearer token"}), 401
        token = auth.split(" ", 1)[1].strip()
        try:
            user = decode_token(token)
        except Exception:
            return jsonify({"error": "Invalid/expired token"}), 401
        request.user = user  # type: ignore
        return fn(*args, **kwargs)
    return wrapper


def require_role(roles):
    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not hasattr(request, "user"):
                return jsonify({"error": "Unauthorized"}), 401
            if request.user.get("role") not in roles:
                return jsonify({"error": "Forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return deco
