import os
import sqlite3
import pandas as pd
from pykrx import stock
import dart_fss as dfss
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

DB_PATH = "web/stocks.db"
API_KEY = os.getenv("DART_API_KEY")

def fetch_and_save_kospi_list():
    # 1. KOSPI, KOSDAQ 종목 리스트 가져오기 (pykrx 사용)
    print("Fetching KOSPI/KOSDAQ ticker list from KRX...")
    all_data = []
    
    for market in ["KOSPI", "KOSDAQ"]:
        tickers = stock.get_market_ticker_list(market=market)
        for ticker in tickers:
            name = stock.get_market_ticker_name(ticker)
            all_data.append({'stock_code': ticker, 'corp_name': name})
    
    df_krx = pd.DataFrame(all_data)
    print(f"Found {len(df_krx)} tickers.")

    # 2. DART 고유번호(corp_code) 매핑 정보 가져오기
    if not API_KEY or API_KEY == "your_api_key_here":
        print("Error: DART_API_KEY is missing. Mapping cannot be performed without API key.")
        return

    print("Initializing DART-FSS and downloading corp codes...")
    dfss.set_api_key(api_key=API_KEY)
    
    # get_corp_list()는 DART에서 모든 기업 리스트(XML)를 다운로드하여 객체화함
    corp_list = dfss.get_corp_list()
    
    # DB 연결
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    success_count = 0
    print("Mapping tickers to DART corp codes and saving to DB...")
    
    for _, row in df_krx.iterrows():
        # 종목코드로 DART 기업 찾기
        target = corp_list.find_by_stock_code(row['stock_code'])
        
        if target:
            corp_code = target.corp_code
            cursor.execute('''
                INSERT OR REPLACE INTO companies (corp_code, stock_code, corp_name, last_updated)
                VALUES (?, ?, ?, ?)
            ''', (corp_code, row['stock_code'], row['corp_name'], None))
            success_count += 1
        else:
            # 상장사임에도 DART 매핑이 안되는 경우 (드물지만 처리)
            print(f"Mapping failed for: {row['corp_name']} ({row['stock_code']})")

    conn.commit()
    conn.close()
    print(f"Successfully saved {success_count} companies to DB.")

if __name__ == "__main__":
    fetch_and_save_kospi_list()
