import sqlite3
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
from pykrx import stock
DB_PATH = "web/stocks.db"

def update_market_cap():
    print("Fetching today's market cap data from KRX...")
    
    import pandas as pd
    
    # 1. 가장 최근의 거래일 찾기 (최근 7일 중 데이터가 있는 날짜 탐색)
    today = datetime.now()
    df_ohlcv_kospi = pd.DataFrame()
    df_ohlcv_kosdaq = pd.DataFrame()
    latest_date = ""
    for i in range(7):
        date_str = (today - pd.Timedelta(days=i)).strftime("%Y%m%d")
        df_ohlcv_kospi = stock.get_market_ohlcv(date_str, market="KOSPI")
        if not df_ohlcv_kospi.empty:
            df_ohlcv_kosdaq = stock.get_market_ohlcv(date_str, market="KOSDAQ")
            latest_date = date_str
            break
            
    df_all = pd.concat([df_ohlcv_kospi, df_ohlcv_kosdaq])
            
    print(f"Using latest business date: {latest_date}")
    
    # DB 연결
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Ensure columns exist (just in case init_db wasn't run)
    try:
        cursor.execute("ALTER TABLE companies ADD COLUMN price_change INTEGER")
        cursor.execute("ALTER TABLE companies ADD COLUMN change_rate REAL")
    except:
        pass

    success_count = 0
    print("Updating market cap, price change, and change rate in DB...")
    
    for stock_code, row in df_all.iterrows():
        try:
            # row['종가'], row['상장주식수'](if exists), row['시가총액'], row['등락률']
            close_price = int(row['종가'])
            market_cap = int(row['시가총액'])
            change_rate = float(row['등락률'])
            
            # Calculate price_change: close_price - prev_close
            # change_rate = (close - prev) / prev * 100
            # prev = close / (1 + change_rate/100)
            # price_change = close - prev
            # Or simpler: prev = close - price_change -> change_rate = price_change / (close - price_change) * 100
            # price_change = (change_rate * close) / (100 + change_rate)
            price_change = int(round((change_rate * close_price) / (100 + change_rate))) if change_rate != -100 else 0
            
            # Since get_market_ohlcv doesn't have shares_outstanding directly, 
            # we calculate it: market_cap / close_price
            shares_outstanding = market_cap // close_price if close_price > 0 else 0
            
            cursor.execute('''
                UPDATE companies 
                SET close_price = ?, shares_outstanding = ?, market_cap = ?, 
                    price_change = ?, change_rate = ?, last_updated = ?
                WHERE stock_code = ?
            ''', (close_price, shares_outstanding, market_cap, price_change, change_rate, datetime.now().isoformat(), stock_code))
            
            if cursor.rowcount > 0:
                success_count += cursor.rowcount
        except Exception as e:
            print(f"Failed to update code {stock_code}: {e}")

    conn.commit()
    conn.close()
    
    print(f"Successfully updated {success_count} companies with market cap data.")

if __name__ == "__main__":
    update_market_cap()
