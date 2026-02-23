import sqlite3

conn = sqlite3.connect('stocks.db')
c = conn.cursor()

# 1. Find names with spaces (likely person names split like "이 재 용")
print("=== 띄어쓰기 있는 주주명 (개인 의심) ===")
rows = c.execute("""
    SELECT DISTINCT shareholder_name 
    FROM shareholders 
    WHERE shareholder_name LIKE '% %' 
    AND shareholder_name != '계'
    AND LENGTH(shareholder_name) <= 10
    ORDER BY shareholder_name
""").fetchall()
for r in rows:
    print(f"  '{r[0]}'")
print(f"  총 {len(rows)}건\n")

# 2. Find potential duplicates: names that become same when spaces removed
print("=== 공백 제거 시 중복되는 이름 ===")
rows = c.execute("""
    SELECT REPLACE(shareholder_name, ' ', '') as normalized, 
           GROUP_CONCAT(DISTINCT shareholder_name) as variants,
           COUNT(DISTINCT shareholder_name) as cnt
    FROM shareholders
    WHERE shareholder_name != '계'
    GROUP BY normalized
    HAVING cnt > 1
    ORDER BY cnt DESC
    LIMIT 30
""").fetchall()
for r in rows:
    print(f"  '{r[0]}' ← [{r[1]}] ({r[2]}개 변형)")
print(f"  총 {len(rows)}건\n")

# 3. Check for '정부' variations
print("=== '정부' 관련 ===")
rows = c.execute("""
    SELECT DISTINCT shareholder_name, COUNT(*) as cnt
    FROM shareholders
    WHERE shareholder_name LIKE '%정부%' OR shareholder_name LIKE '%국가%' OR shareholder_name LIKE '%국민%'
    GROUP BY shareholder_name
    ORDER BY cnt DESC
""").fetchall()
for r in rows:
    print(f"  '{r[0]}' ({r[1]}건)")

# 4. Check for common entity variations
print("\n=== 기타 의심 변형 ===")
rows = c.execute("""
    SELECT DISTINCT shareholder_name, COUNT(*) as cnt
    FROM shareholders
    WHERE shareholder_name LIKE '%자사주%' 
       OR shareholder_name LIKE '%자기주식%'
       OR shareholder_name LIKE '%우리사주%'
       OR shareholder_name LIKE '%국민연금%'
    GROUP BY shareholder_name
    ORDER BY cnt DESC
""").fetchall()
for r in rows:
    print(f"  '{r[0]}' ({r[1]}건)")

conn.close()
