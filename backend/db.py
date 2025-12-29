import os
import sqlite3
from pathlib import Path
from flask import g

DEFAULT_DB = "./data/app.db"

def get_db_path() -> str:
    return os.getenv("DATABASE_PATH", DEFAULT_DB)

def ensure_db_folder():
    db_path = Path(get_db_path())
    db_path.parent.mkdir(parents=True, exist_ok=True)

def connect():
    ensure_db_folder()
    conn = sqlite3.connect(get_db_path(), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def get_db():
    if "db" not in g:
        g.db = connect()
    return g.db

def close_db(_e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db(app):
    with app.app_context():
        db = get_db()
        schema_path = Path(app.root_path) / "schema.sql"
        db.executescript(schema_path.read_text(encoding="utf-8"))
        db.commit()
