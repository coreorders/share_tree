import os
import sqlite3
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = "web/stocks.db"
API_KEY = os.getenv("DART_API_KEY")
BASE_URL = "https://opendart.fss.or.kr/api/otrCprInvstmntSttus.json" # 타법인출자현황

def fetch_subsidiaries(corp_code):
    """특정 기업의 타법인출자현황(종속기업 등) 데이터를 DART에서 가져옵니다."""
    params = {
        'crtfc_key': API_KEY,
        'corp_code': corp_code,
        'bsns_year': '2023', # 최신 사업보고서 기준
        'reprt_code': '11011' # 사업보고서
    }
    try:
        response = requests.get(BASE_URL, params=params)
        data = response.json()
        if data.get('status') == '000':
            return data.get('list', [])
        else:
            print(f"[{corp_code}] API Error: {data.get('message')}")
            return []
    except Exception as e:
        print(f"[{corp_code}] Request Exception: {e}")
        return []

def run_bulk_collection():
    if not API_KEY or API_KEY == "your_api_key_here":
        print("Error: DART_API_KEY is missing. Bulk collection aborted.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 업데이트 대상: KOSPI/KOSDAQ 기업 모두 또는 일부
    cursor.execute("SELECT corp_code, corp_name FROM companies ORDER BY last_updated ASC")
    companies = cursor.fetchall()
    
    print(f"Starting bulk collection for {len(companies)} companies...")

    for corp_code, corp_name in companies:
        print(f"Fetching subsidiary data for: {corp_name} ({corp_code})...")
        subsidiaries = fetch_subsidiaries(corp_code)
        
        # 기존 종속기업 데이터 삭제 (최신 데이터로 교체)
        cursor.execute("DELETE FROM subsidiaries WHERE corp_code = ?", (corp_code,))
        
        valid_count = 0
        for sub in subsidiaries:
            # 타법인출자현황 필드는 nm, invt_cpr_nm, corp_nm 등 유동적일 수 있음
            sub_name = sub.get('nm') or sub.get('invt_cpr_nm') or sub.get('corp_nm')
            # 출자 사유/관계는 relate, invt_purps, rm 등에 있을 수 있음
            reason = sub.get('relate') or sub.get('invt_purps') or sub.get('rm', '')
            reason = str(reason).strip()
            
            if not sub_name:
                continue

            # 지분율 및 주식수 (응답 포맷에 따라 bsis_ 또는 trmend_ 접두어가 붙을 수 있음)
            try:
                rate_str = sub.get('trmend_posesn_stock_qota_rt') or sub.get('trmend_posesn_stock_rt') or sub.get('bsis_posesn_stock_qota_rt') or '0'
                rate = float(rate_str) if rate_str and rate_str != '-' else 0.0
                
                count_str = sub.get('trmend_posesn_stock_co') or sub.get('bsis_posesn_stock_co') or '0'
                count = int(count_str.replace(',', '')) if count_str and count_str != '-' else 0
            except Exception as e:
                rate, count = 0.0, 0
            
            # 지분율이 0 초과인 경우만 저장 (유의미한 출자만)
            if rate > 0:
                cursor.execute('''
                    INSERT INTO subsidiaries (corp_code, subsidiary_name, share_rate, shares_count, reason, collected_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (corp_code, sub_name, rate, count, reason, datetime.now()))
                valid_count += 1
        
        conn.commit()
        print(f"  - Saved {valid_count} subsidiaries.")
        
        # API 과부하 방지 (DART 한도 고려)
        time.sleep(0.3)

    conn.close()
    print("Bulk collection completed.")

if __name__ == "__main__":
    run_bulk_collection()
