import sqlite3
import os
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = "web/stocks.db"
API_KEY = os.getenv("DART_API_KEY")

# A+B 통합: 임원ㆍ주요주주 특정증권등 소유상황보고
URL_EXEC_REPORT = "https://opendart.fss.or.kr/api/elestock.json"
# C: 자기주식 취득 및 처분 현황
URL_TREASURY = "https://opendart.fss.or.kr/api/tesstkAcqsDspsSttus.json"
# D: 배당에 관한 사항
URL_DIVIDENDS = "https://opendart.fss.or.kr/api/alotMatter.json"

def fetch_dart(url, corp_code, year='2023', report_code='11011'):
    if not API_KEY:
        return []
    params = {
        'crtfc_key': API_KEY,
        'corp_code': corp_code,
        'bsns_year': year,
        'reprt_code': report_code
    }
    try:
        res = requests.get(url, params=params, timeout=10)
        data = res.json()
        if data.get('status') == '000':
            return data.get('list', [])
        elif data.get('status') != '013':
            print(f"  [{url.split('/')[-1]}] {data.get('message')}")
        return []
    except Exception as e:
        print(f"  [{url.split('/')[-1]}] Error: {e}")
        return []

def safe_int(v):
    try:
        return int(str(v).replace(',', '').strip()) if v and str(v).strip() not in ('-', '') else 0
    except:
        return 0

def safe_float(v):
    try:
        return float(str(v).replace(',', '').strip()) if v and str(v).strip() not in ('-', '') else 0.0
    except:
        return 0.0

def run_collection():
    if not os.path.exists(DB_PATH):
        print(f"Error: DB not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT corp_code, corp_name FROM companies")
    companies = cursor.fetchall()
    total = len(companies)
    print(f"Starting Weekly Extra Collection for {total} companies...")

    for idx, (corp_code, corp_name) in enumerate(companies, 1):
        print(f"[{idx}/{total}] {corp_name} ({corp_code})")
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        counts = {'AB': 0, 'C': 0, 'D': 0}

        # ── A+B: 임원ㆍ주요주주 소유보고 (elestock.json) ──
        for d in fetch_dart(URL_EXEC_REPORT, corp_code):
            repror = (d.get('repror') or '').strip()
            rcept_no = (d.get('rcept_no') or '').strip()
            if not repror or not rcept_no:
                continue
            try:
                cursor.execute('''
                    INSERT OR IGNORE INTO exec_shareholder_reports
                    (corp_code, rcept_no, rcept_dt, repror, isu_exctv_rgist_at, isu_exctv_ofcps,
                     isu_main_shrholdr, sp_stock_lmp_cnt, sp_stock_lmp_irds_cnt,
                     sp_stock_lmp_rate, sp_stock_lmp_irds_rate, collected_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    corp_code, rcept_no,
                    (d.get('rcept_dt') or '').strip(),
                    repror,
                    (d.get('isu_exctv_rgist_at') or '').strip(),
                    (d.get('isu_exctv_ofcps') or '').strip(),
                    (d.get('isu_main_shrholdr') or '').strip(),
                    safe_int(d.get('sp_stock_lmp_cnt')),
                    safe_int(d.get('sp_stock_lmp_irds_cnt')),
                    safe_float(d.get('sp_stock_lmp_rate')),
                    safe_float(d.get('sp_stock_lmp_irds_rate')),
                    now_str
                ))
                if cursor.rowcount > 0:
                    counts['AB'] += 1
            except Exception as e:
                print(f"  Insert error (AB): {e}")

        # ── C: 자기주식 취득 및 처분 (tesstkAcqsDspsSttus.json) ──
        data_C = fetch_dart(URL_TREASURY, corp_code)
        if data_C:
            cursor.execute("DELETE FROM treasury_shares WHERE corp_code = ?", (corp_code,))
            for d in data_C:
                try:
                    cursor.execute('''
                        INSERT INTO treasury_shares
                        (corp_code, stock_knd, acqs_mth1, acqs_mth2, acqs_mth3,
                         bsis_qy, change_qy_acqs, change_qy_dsps, change_qy_incnr,
                         trmend_qy, rm, collected_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        corp_code,
                        (d.get('stock_knd') or '').strip(),
                        (d.get('acqs_mth1') or '').strip(),
                        (d.get('acqs_mth2') or '').strip(),
                        (d.get('acqs_mth3') or '').strip(),
                        (d.get('bsis_qy') or '').strip(),
                        (d.get('change_qy_acqs') or '').strip(),
                        (d.get('change_qy_dsps') or '').strip(),
                        (d.get('change_qy_incnr') or '').strip(),
                        (d.get('trmend_qy') or '').strip(),
                        (d.get('rm') or '').strip(),
                        now_str
                    ))
                    if cursor.rowcount > 0:
                        counts['C'] += 1
                except Exception as e:
                    print(f"  Insert error (C): {e}")

        # ── D: 배당에 관한 사항 (alotMatter.json) ──
        for d in fetch_dart(URL_DIVIDENDS, corp_code):
            se = (d.get('se') or '').strip()
            if not se:
                continue
            stock_knd = (d.get('stock_knd') or '').strip()
            try:
                cursor.execute('''
                    INSERT OR IGNORE INTO dividends
                    (corp_code, se, stock_knd, thstrm, frmtrm, lwfr, collected_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    corp_code, se, stock_knd,
                    (d.get('thstrm') or '').strip(),
                    (d.get('frmtrm') or '').strip(),
                    (d.get('lwfr') or '').strip(),
                    now_str
                ))
                if cursor.rowcount > 0:
                    counts['D'] += 1
            except Exception as e:
                print(f"  Insert error (D): {e}")

        total_saved = sum(counts.values())
        if total_saved > 0:
            print(f"  > Saved: Report={counts['AB']}, Treasury={counts['C']}, Div={counts['D']}")
            conn.commit()

        # Rate Limit: 3 calls per company → ~20 per sec is fine with 0.3s sleep
        time.sleep(0.3)

    conn.close()
    print("Weekly extra collection completed.")

if __name__ == "__main__":
    run_collection()
