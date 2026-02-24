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

    # 임원 현황 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS executives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corp_code TEXT,
        name TEXT,
        position TEXT,
        birth_ym TEXT,
        is_registered TEXT,
        career TEXT,
        responsibilities TEXT,
        collected_at DATETIME,
        FOREIGN KEY (corp_code) REFERENCES companies (corp_code)
    )
    ''')

    # 개인별 보수 지급금액 (5억 이상) 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS compensations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corp_code TEXT,
        name TEXT,
        position TEXT,
        amount_str TEXT,
        amount_num INTEGER,
        collected_at DATETIME,
        FOREIGN KEY (corp_code) REFERENCES companies (corp_code)
    )
    ''')

    # 최대주주 변동현황 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS major_shareholder_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corp_code TEXT,
        mxmm_shrholdr_nm TEXT,
        change_on TEXT,
        posesn_stock_co INTEGER,
        qota_rt REAL,
        change_cause TEXT,
        rm TEXT,
        collected_at DATETIME,
        FOREIGN KEY (corp_code) REFERENCES companies (corp_code),
        UNIQUE(corp_code, mxmm_shrholdr_nm, change_on, posesn_stock_co)
    )
    ''')

    # 임원ㆍ주요주주 특정증권등 소유상황보고 (elestock.json) 테이블
    # A+B 통합: 동일 엔드포인트이므로 하나의 테이블로 관리
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS exec_shareholder_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corp_code TEXT,
        rcept_no TEXT,
        rcept_dt TEXT,
        repror TEXT,
        isu_exctv_rgist_at TEXT,
        isu_exctv_ofcps TEXT,
        isu_main_shrholdr TEXT,
        sp_stock_lmp_cnt INTEGER,
        sp_stock_lmp_irds_cnt INTEGER,
        sp_stock_lmp_rate REAL,
        sp_stock_lmp_irds_rate REAL,
        collected_at DATETIME,
        FOREIGN KEY (corp_code) REFERENCES companies (corp_code),
        UNIQUE(corp_code, rcept_no, repror)
    )
    ''')

    # 자기주식 취득 및 처분 현황 (tesstkAcqsDspsSttus.json) 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS treasury_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corp_code TEXT,
        stock_knd TEXT,
        acqs_mth1 TEXT,
        acqs_mth2 TEXT,
        acqs_mth3 TEXT,
        bsis_qy TEXT,
        change_qy_acqs TEXT,
        change_qy_dsps TEXT,
        change_qy_incnr TEXT,
        trmend_qy TEXT,
        rm TEXT,
        collected_at DATETIME,
        FOREIGN KEY (corp_code) REFERENCES companies (corp_code)
    )
    ''')

    # 배당에 관한 사항 (alotMatter.json) 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS dividends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corp_code TEXT,
        se TEXT,
        stock_knd TEXT,
        thstrm TEXT,
        frmtrm TEXT,
        lwfr TEXT,
        collected_at DATETIME,
        FOREIGN KEY (corp_code) REFERENCES companies (corp_code),
        UNIQUE(corp_code, se, stock_knd)
    )
    ''')

    conn.commit()
    conn.close()
    print(f"Database initialized at {os.path.abspath(DB_PATH)}")

if __name__ == "__main__":
    init_db()
