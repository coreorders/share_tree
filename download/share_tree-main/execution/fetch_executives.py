import os
import sqlite3
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = "web/stocks.db"
API_KEY = os.getenv("DART_API_KEY")
EXEC_URL = "https://opendart.fss.or.kr/api/exctvSttus.json" # 임원현황
COMP_URL = "https://opendart.fss.or.kr/api/indvdlByPay.json" # 개인별 보수지급금액

def fetch_executives_data(corp_code):
    """임원 현황을 가져옵니다."""
    params = {
        'crtfc_key': API_KEY,
        'corp_code': corp_code,
        'bsns_year': '2023',
        'reprt_code': '11011' # 사업보고서
    }
    try:
        res = requests.get(EXEC_URL, params=params, timeout=10)
        data = res.json()
        if data.get('status') == '000':
            return data.get('list', [])
        return []
    except Exception as e:
        print(f"[{corp_code}] Exec API Error: {e}")
        return []

def fetch_compensations_data(corp_code):
    """임원 개인별 보수 지급 금액을 가져옵니다."""
    params = {
        'crtfc_key': API_KEY,
        'corp_code': corp_code,
        'bsns_year': '2023',
        'reprt_code': '11011'
    }
    try:
        res = requests.get(COMP_URL, params=params, timeout=10)
        data = res.json()
        if data.get('status') == '000':
            return data.get('list', [])
        return []
    except Exception as e:
        print(f"[{corp_code}] Comp API Error: {e}")
        return []

def run_collection():
    if not API_KEY or API_KEY == "your_api_key_here":
        print("Error: DART_API_KEY is missing.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT corp_code, corp_name FROM companies ORDER BY last_updated ASC")
    companies = cursor.fetchall()
    
    print(f"Starting executive & compensation collection for {len(companies)} companies...")

    for corp_code, corp_name in companies:
        print(f"Fetching data for: {corp_name} ({corp_code})...")
        
        execs = fetch_executives_data(corp_code)
        comps = fetch_compensations_data(corp_code)
        
        if execs or comps:
            # Delete old records
            cursor.execute("DELETE FROM executives WHERE corp_code = ?", (corp_code,))
            cursor.execute("DELETE FROM compensations WHERE corp_code = ?", (corp_code,))
            
            # Insert Executives
            exec_count = 0
            for ex in execs:
                name = ex.get('nm', '').strip()
                if not name: continue
                pos = ex.get('ofcps', '')
                birth = ex.get('birth_ym', '')
                is_reg = ex.get('rgist_exctv_at', '')
                career = ex.get('main_career', '')
                resp = ex.get('chrg_job', '')
                
                cursor.execute('''
                    INSERT INTO executives (corp_code, name, position, birth_ym, is_registered, career, responsibilities, collected_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (corp_code, name, pos, birth, is_reg, career, resp, datetime.now()))
                exec_count += 1
                
            # Insert Compensations
            comp_count = 0
            for cp in comps:
                name = cp.get('nm', '').strip()
                if not name: continue
                pos = cp.get('ofcps', '')
                amt_str = cp.get('mendng_totamt', '0')
                
                try:
                    # Remove commas and parse
                    amt_num = int(amt_str.replace(',', '')) if amt_str and amt_str != '-' else 0
                except:
                    amt_num = 0
                    
                if amt_num > 0:
                    cursor.execute('''
                        INSERT INTO compensations (corp_code, name, position, amount_str, amount_num, collected_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (corp_code, name, pos, amt_str, amt_num, datetime.now()))
                    comp_count += 1
            
            conn.commit()
            print(f"  - Saved {exec_count} execs, {comp_count} comps.")
        
        # Sleep to avoid DART API limit
        time.sleep(0.5)

    conn.close()
    print("Collection completed.")

if __name__ == "__main__":
    run_collection()
