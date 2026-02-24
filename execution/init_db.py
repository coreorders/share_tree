import sqlite3
import os

DB_PATH = "web/stocks.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 기업 정보 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS companies (
        corp_code TEXT PRIMARY KEY,
        stock_code TEXT,
        corp_name TEXT,
        last_updated DATETIME,
        close_price INTEGER,
        shares_outstanding INTEGER,
        market_cap INTEGER,
        price_change INTEGER,
        change_rate REAL
    )
    ''')

    # 주주 지분 정보 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS shareholders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_corp_code TEXT,
        shareholder_name TEXT,
        share_rate REAL,
        shares_count INTEGER,
        collected_at DATETIME,
        FOREIGN KEY (target_corp_code) REFERENCES companies (corp_code)
    )
    ''')

    # 종속기업/타법인출자 정보 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS subsidiaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corp_code TEXT,
        subsidiary_name TEXT,
        share_rate REAL,
        shares_count INTEGER,
        reason TEXT,
        collected_at DATETIME,
        FOREIGN KEY (corp_code) REFERENCES companies (corp_code)
    )
    ''')

    conn.commit()
    conn.close()
    print(f"Database initialized at {os.path.abspath(DB_PATH)}")

if __name__ == "__main__":
    init_db()
