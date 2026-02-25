import sqlite3
import os
import requests
import time
import datetime
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = "web/stocks.db"
API_KEY = os.getenv("DART_API_KEY")

# API URLs
URL_EXEC_REPORT = "https://opendart.fss.or.kr/api/elestock.json"      # 임원/주요주주 소유보고
URL_TREASURY = "https://opendart.fss.or.kr/api/tesstkAcqsDspsSttus.json" # 자기주식
URL_DIVIDENDS = "https://opendart.fss.or.kr/api/alotMatter.json"         # 배당
URL_MAJOR_CHG = "https://opendart.fss.or.kr/api/hyslrChgSttus.json"      # 최대주주 변동
URL_SUBSID = "https://opendart.fss.or.kr/api/otrCprInvstmntSttus.json"    # 타법인출자(종속회사)
URL_EXEC_STATUS = "https://opendart.fss.or.kr/api/exctvSttus.json"      # 임원현황
URL_COMP = "https://opendart.fss.or.kr/api/indvdlByPay.json"            # 개인별 보수

def safe_int(v):
    try:
        if v is None: return 0
        v_str = str(v).replace(',', '').strip()
        return int(v_str) if v_str not in ('-', '') else 0
    except:
        return 0

def safe_float(v):
    try:
        if v is None: return 0.0
        v_str = str(v).replace(',', '').strip()
        return float(v_str) if v_str not in ('-', '') else 0.0
    except:
        return 0.0

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
        res = requests.get(url, params=params, timeout=15)
        data = res.json()
        if data.get('status') == '000':
            return data.get('list', [])
        return []
    except Exception as e:
        return []

def run_all_collection(limit=None):
    if not API_KEY:
        print("Error: DART_API_KEY is missing.")
        return

    if not os.path.exists(DB_PATH):
        print(f"Error: DB not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get companies
    query = "SELECT corp_code, corp_name FROM companies"
    if limit:
        query += f" LIMIT {limit}"
    cursor.execute(query)
    companies = cursor.fetchall()
    total = len(companies)
    
    print(f"🚀 Starting Unified Weekly Collection for {total} companies...")
    start_time = time.time()

    for idx, (corp_code, corp_name) in enumerate(companies, 1):
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{idx}/{total}] {corp_name} ({corp_code}) Processing...", end="\r")
        
        # 1. Insider Reports (A+B)
        data_ab = fetch_dart(URL_EXEC_REPORT, corp_code)
        for d in data_ab:
            repror = (d.get('repror') or '').strip()
            rcept_no = (d.get('rcept_no') or '').strip()
            if repror and rcept_no:
                cursor.execute('''
                    INSERT OR IGNORE INTO exec_shareholder_reports
                    (corp_code, rcept_no, rcept_dt, repror, isu_exctv_rgist_at, isu_exctv_ofcps,
                     isu_main_shrholdr, sp_stock_lmp_cnt, sp_stock_lmp_irds_cnt,
                     sp_stock_lmp_rate, sp_stock_lmp_irds_rate, collected_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (corp_code, rcept_no, d.get('rcept_dt',''), repror, 
                      d.get('isu_exctv_rgist_at',''), d.get('isu_exctv_ofcps',''),
                      d.get('isu_main_shrholdr',''), safe_int(d.get('sp_stock_lmp_cnt')),
                      safe_int(d.get('sp_stock_lmp_irds_cnt')), safe_float(d.get('sp_stock_lmp_rate')),
                      safe_float(d.get('sp_stock_lmp_irds_rate')), now_str))

        # 2. Treasury Shares (C)
        data_c = fetch_dart(URL_TREASURY, corp_code)
        if data_c:
            cursor.execute("DELETE FROM treasury_shares WHERE corp_code = ?", (corp_code,))
            for d in data_c:
                cursor.execute('''
                    INSERT INTO treasury_shares (corp_code, stock_knd, bsis_qy, change_qy_acqs, change_qy_dsps, trmend_qy, collected_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (corp_code, d.get('stock_knd',''), d.get('bsis_qy',''), d.get('change_qy_acqs',''), 
                      d.get('change_qy_dsps',''), d.get('trmend_qy',''), now_str))

        # 3. Dividends (D)
        data_d = fetch_dart(URL_DIVIDENDS, corp_code)
        for d in data_d:
            se = (d.get('se') or '').strip()
            if se:
                cursor.execute('''
                    INSERT OR IGNORE INTO dividends (corp_code, se, stock_knd, thstrm, frmtrm, lwfr, collected_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (corp_code, se, d.get('stock_knd',''), d.get('thstrm',''), d.get('frmtrm',''), d.get('lwfr',''), now_str))

        # 4. Major Shareholder Changes
        data_major = fetch_dart(URL_MAJOR_CHG, corp_code)
        for d in data_major:
            nm = (d.get('mxmm_shrholdr_nm') or '').strip()
            if nm:
                cursor.execute('''
                    INSERT OR IGNORE INTO major_shareholder_changes 
                    (corp_code, mxmm_shrholdr_nm, change_on, posesn_stock_co, qota_rt, change_cause, rm, collected_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (corp_code, nm, d.get('change_on',''), safe_int(d.get('posesn_stock_co')), 
                      safe_float(d.get('qota_rt')), d.get('change_cause',''), d.get('rm',''), now_str))

        # 5. Subsidiaries
        data_sub = fetch_dart(URL_SUBSID, corp_code)
        if data_sub:
            cursor.execute("DELETE FROM subsidiaries WHERE corp_code = ?", (corp_code,))
            for sub in data_sub:
                sub_name = sub.get('inv_prm') or sub.get('nm') or sub.get('invt_cpr_nm') or sub.get('corp_nm')
                rate = safe_float(sub.get('trmend_blce_qota_rt') or sub.get('trmend_posesn_stock_qota_rt') or sub.get('bsis_blce_qota_rt'))
                if sub_name and rate > 0:
                    cursor.execute('''
                        INSERT INTO subsidiaries (corp_code, subsidiary_name, share_rate, shares_count, reason, collected_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (corp_code, sub_name, rate, safe_int(sub.get('trmend_blce_qy') or sub.get('bsis_blce_qy')), 
                          sub.get('invstmnt_purps') or sub.get('relate') or '', now_str))

        # 6. Executives & Compensations
        data_exec = fetch_dart(URL_EXEC_STATUS, corp_code)
        if data_exec:
            cursor.execute("DELETE FROM executives WHERE corp_code = ?", (corp_code,))
            for ex in data_exec:
                name = (ex.get('nm') or '').strip()
                if name:
                    cursor.execute('''
                        INSERT INTO executives (corp_code, name, position, birth_ym, is_registered, career, responsibilities, collected_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (corp_code, name, ex.get('ofcps',''), ex.get('birth_ym',''), ex.get('rgist_exctv_at',''), 
                          ex.get('main_career',''), ex.get('chrg_job',''), now_str))

        data_comp = fetch_dart(URL_COMP, corp_code)
        if data_comp:
            cursor.execute("DELETE FROM compensations WHERE corp_code = ?", (corp_code,))
            for cp in data_comp:
                name = (cp.get('nm') or '').strip()
                amt = safe_int(cp.get('mendng_totamt'))
                if name and amt > 0:
                    cursor.execute('''
                        INSERT INTO compensations (corp_code, name, position, amount_str, amount_num, collected_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (corp_code, name, cp.get('ofcps',''), cp.get('mendng_totamt','0'), amt, now_str))

        # Commit per company for safety
        conn.commit()
        
        # Throttling
        time.sleep(0.3)

    conn.close()
    elapsed = time.time() - start_time
    print(f"\n✅ All-in-one weekly collection completed in {elapsed/60:.1f} minutes.")

if __name__ == "__main__":
    run_all_collection()
