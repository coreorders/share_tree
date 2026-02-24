import sqlite3
import json
import os
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = "web/stocks.db"
API_KEY = os.getenv("DART_API_KEY")
API_URL = "https://opendart.fss.or.kr/api/hyslrChgSttus.json" # 최대주주 변동현황

def fetch_major_shareholder_changes(corp_code):
    if not API_KEY:
        print("Error: DART_API_KEY is not set.")
        return []

    # 최근 연도 사업보고서 기준 (2023년)
    params = {
        'crtfc_key': API_KEY,
        'corp_code': corp_code,
        'bsns_year': '2023',
        'reprt_code': '11011' # 사업보고서
    }

    try:
        response = requests.get(API_URL, params=params, timeout=10)
        data = response.json()
        
        if data.get('status') == '000':
            return data.get('list', [])
        else:
            if data.get('status') != '013': # 013 is "조회된 데이타가 없습니다."
                print(f"[{corp_code}] API Error: {data.get('message')}")
            return []
            
    except Exception as e:
        print(f"[{corp_code}] Request failed: {e}")
        return []

def run_collection():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT corp_code, corp_name FROM companies")
    companies = cursor.fetchall()
    
    total = len(companies)
    print(f"Starting major shareholder changes collection for {total} companies...")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    for idx, (corp_code, corp_name) in enumerate(companies, 1):
        print(f"[{idx}/{total}] Fetching data for: {corp_name} ({corp_code})...")
        
        changes = fetch_major_shareholder_changes(corp_code)
        
        saved_count = 0
        for change in changes:
            # mxmm_shrholdr_nm(최대주주명), change_on(변동일), posesn_stock_co(소유주식수), qota_rt(지분율), change_cause(변동원인), rm(비고)
            mxmm_shrholdr_nm = change.get('mxmm_shrholdr_nm', '').strip()
            change_on = change.get('change_on', '').strip()
            
            # 주식수 파싱
            count_str = str(change.get('posesn_stock_co', '0')).replace(',', '').strip()
            try:
                posesn_stock_co = int(count_str) if count_str and count_str != '-' else 0
            except:
                posesn_stock_co = 0
                
            # 지분율 파싱
            rate_str = str(change.get('qota_rt', '0')).replace(',', '').strip()
            try:
                qota_rt = float(rate_str) if rate_str and rate_str != '-' else 0.0
            except:
                qota_rt = 0.0
                
            change_cause = change.get('change_cause', '').strip()
            rm = change.get('rm', '').strip()

            if not mxmm_shrholdr_nm:
                continue

            try:
                # UNIQUE 제약조건(corp_code, mxmm_shrholdr_nm, change_on, posesn_stock_co)으로 인해 
                # 중복 데이터는 IGNORE 처리됨
                cursor.execute('''
                    INSERT OR IGNORE INTO major_shareholder_changes 
                    (corp_code, mxmm_shrholdr_nm, change_on, posesn_stock_co, qota_rt, change_cause, rm, collected_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (corp_code, mxmm_shrholdr_nm, change_on, posesn_stock_co, qota_rt, change_cause, rm, now_str))
                
                # 중복이 아니어서 실제로 삽입되었다면 rowcount는 1
                if cursor.rowcount > 0:
                    saved_count += 1
            except Exception as e:
                print(f"  Error inserting record for {corp_name}: {e}")
                
        if saved_count > 0:
            print(f"  > Saved {saved_count} new changes.")
            conn.commit()

        # DART API Rate Limit (10,000 per day, max 1000 per minute)
        time.sleep(0.3)

    conn.close()
    print("Collection completed.")

if __name__ == "__main__":
    run_collection()
