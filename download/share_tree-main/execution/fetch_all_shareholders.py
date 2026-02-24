import os
import sqlite3
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = "web/stocks.db"
API_KEY = os.getenv("DART_API_KEY")
BASE_URL = "https://opendart.fss.or.kr/api/hyslrSttus.json" # 최대주주 현황

def fetch_major_shareholders(corp_code):
    """특정 기업의 지분 데이터를 DART에서 가져옵니다."""
    params = {
        'crtfc_key': API_KEY,
        'corp_code': corp_code,
        'bsns_year': '2023',
        'reprt_code': '11011' # 11011: 사업보고서, 11012: 반기보고서, 11013: 1분기보고서, 11014: 3분기보고서
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

    # 업데이트가 필요한 기업들 추출 (최근 업데이트가 없는 순)
    cursor.execute("SELECT corp_code, corp_name FROM companies ORDER BY last_updated ASC")
    companies = cursor.fetchall()
    
    print(f"Starting bulk collection for {len(companies)} companies...")

    for corp_code, corp_name in companies:
        print(f"Fetching data for: {corp_name} ({corp_code})...")
        shareholders = fetch_major_shareholders(corp_code)
        
        # 이전 지분 데이터 삭제 (최신 데이터로 교체)
        cursor.execute("DELETE FROM shareholders WHERE target_corp_code = ?", (corp_code,))
        
        for sh in shareholders:
            name = sh.get('nm')
            if not name:
                continue

            # 지분율 및 주식수 클렌징 (기말 보유 주식 기준)
            try:
                rate_str = sh.get('trmend_posesn_stock_qota_rt', '0')
                rate = float(rate_str) if rate_str and rate_str != '-' else 0.0
                
                count_str = sh.get('trmend_posesn_stock_num', '0')
                count = int(count_str.replace(',', '')) if count_str and count_str != '-' else 0
            except Exception as e:
                print(f"Parsing error for {name}: {e}")
                rate, count = 0.0, 0
                
            cursor.execute('''
                INSERT INTO shareholders (target_corp_code, shareholder_name, share_rate, shares_count, collected_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (corp_code, name, rate, count, datetime.now()))
        
        # 기업 정보 테이블의 last_updated 갱신
        cursor.execute("UPDATE companies SET last_updated = ? WHERE corp_code = ?", (datetime.now(), corp_code))
        
        conn.commit()
        print(f"  - Saved {len(shareholders)} shareholders.")
        
        # API 과부하 방지 및 할당량 관리 (초당 약 2~3회 제한 준수)
        time.sleep(0.5)

    conn.close()
    print("Bulk collection completed.")

if __name__ == "__main__":
    run_bulk_collection()
