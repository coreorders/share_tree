import sqlite3

def check_db():
    try:
        # uri=True와 mode=ro 옵션을 주어 읽기 전용으로 열어 Lock 회피
        conn = sqlite3.connect('file:stocks.db?mode=ro', uri=True, timeout=5.0)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM companies")
        total_companies = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM shareholders")
        total_shareholders = cursor.fetchone()[0]
        
        # 마지막으로 데이터가 언제 적재되었고 최신 5건이 누군지 확인
        cursor.execute("SELECT target_corp_code, shareholder_name, share_rate, shares_count FROM shareholders ORDER BY id DESC LIMIT 5")
        rows = cursor.fetchall()
        
        print(f"Total Companies: {total_companies}")
        print(f"Total Shareholders (collected so far): {total_shareholders}")
        print("\nLast 5 inserted shareholders:")
        for r in rows:
            print(f" Corp Code: {r[0]} | Shareholder: {r[1]} | Ratio: {r[2]}% | Count: {r[3]}")
            
    except sqlite3.OperationalError as e:
        print(f"Database read failed: {e}")

if __name__ == "__main__":
    check_db()
