import sqlite3

conn = sqlite3.connect('stocks.db')
c = conn.cursor()

# Check for 두산연강재단's holdings
rows = c.execute("""
    SELECT s.shareholder_name, s.share_rate, s.shares_count, c.corp_name, c.corp_code, s.rowid
    FROM shareholders s
    JOIN companies c ON s.target_corp_code = c.corp_code
    WHERE s.shareholder_name = '두산연강재단'
    ORDER BY c.corp_name, s.share_rate DESC
""").fetchall()

print("=== 두산연강재단 보유지분 ===")
for r in rows:
    print(f"  rowid={r[5]} | {r[3]} ({r[4]}) | {r[1]}% | {r[2]}주")

# Check if 두산퓨얼셀 has multiple corp_codes
print("\n=== 두산퓨얼셀 corp_code 확인 ===")
rows2 = c.execute("SELECT corp_code, corp_name, stock_code FROM companies WHERE corp_name LIKE '%두산퓨얼셀%'").fetchall()
for r in rows2:
    print(f"  {r[0]} | {r[1]} | stock:{r[2]}")

# General check: any shareholder with duplicate target_corp_code entries
print("\n=== 동일인+동일기업 중복 (TOP 20) ===")
dups = c.execute("""
    SELECT shareholder_name, target_corp_code, COUNT(*) as cnt, GROUP_CONCAT(share_rate) as rates
    FROM shareholders
    WHERE shareholder_name != '계'
    GROUP BY shareholder_name, target_corp_code
    HAVING cnt > 1
    ORDER BY cnt DESC
    LIMIT 20
""").fetchall()
for d in dups:
    print(f"  {d[0]} → {d[1]} | {d[2]}건 | rates: {d[3]}")

print(f"\n  총 중복 쌍: {len(dups)}건")

conn.close()
