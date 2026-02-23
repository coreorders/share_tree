import sqlite3
from pykrx import stock
from datetime import datetime

DB_PATH = "web/stocks.db"

def update_market_cap():
    print("Fetching today's market cap data from KRX...")
    
    import pandas as pd
    
    # 1. 가장 최근의 거래일 찾기 (최근 7일 중 데이터가 있는 날짜 탐색)
    today = datetime.now()
    df_cap_kospi = pd.DataFrame()
    df_cap_kosdaq = pd.DataFrame()
    latest_date = ""
    for i in range(7):
        date_str = (today - pd.Timedelta(days=i)).strftime("%Y%m%d")
        df_cap_kospi = stock.get_market_cap(date_str, market="KOSPI")
        if not df_cap_kospi.empty:
            df_cap_kosdaq = stock.get_market_cap(date_str, market="KOSDAQ")
            latest_date = date_str
            break
            
    df_cap = pd.concat([df_cap_kospi, df_cap_kosdaq])
            
    print(f"Using latest business date: {latest_date}")
    
    # DB 연결
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    success_count = 0
    print("Updating market cap, shares outstanding, and close price in DB...")
    
    for stock_code, row in df_cap.iterrows():
        try:
            # row['종가'], row['상장주식수'], row['시가총액']
            close_price = int(row['종가'])
            shares_outstanding = int(row['상장주식수'])
            market_cap = int(row['시가총액'])
            
            cursor.execute('''
                UPDATE companies 
                SET close_price = ?, shares_outstanding = ?, market_cap = ?
                WHERE stock_code = ?
            ''', (close_price, shares_outstanding, market_cap, stock_code))
            
            if cursor.rowcount > 0:
                success_count += cursor.rowcount
        except Exception as e:
            print(f"Failed to update code {stock_code}: {e}")

    conn.commit()
    conn.close()
    
    print(f"Successfully updated {success_count} companies with market cap data.")

if __name__ == "__main__":
    update_market_cap()
