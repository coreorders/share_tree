import sqlite3

conn = sqlite3.connect('stocks.db')
c = conn.cursor()

fixes = [
    ('삼성생명 (고객계정)', '삼성생명(고객계정)'),
    ('Tina Mikyung Lee', 'Tina MikyungLee'),
    ('(주) 현대백화점', '(주)현대백화점'),
    ('(재)홍진기 법률연구재단', '(재)홍진기법률연구재단'),
    ('정  부(산업통상자원부)', '대한민국정부'),
]

total = 0
for old, new in fixes:
    c.execute("UPDATE shareholders SET shareholder_name = ? WHERE shareholder_name = ?", (new, old))
    cnt = c.rowcount
    total += cnt
    print(f"  '{old}' -> '{new}': {cnt}건")

conn.commit()

# Final check
remaining = c.execute("""
    SELECT REPLACE(shareholder_name, ' ', '') as normalized,
           GROUP_CONCAT(DISTINCT shareholder_name) as variants,
           COUNT(DISTINCT shareholder_name) as cnt
    FROM shareholders
    GROUP BY normalized
    HAVING cnt > 1
    LIMIT 10
""").fetchall()

print(f"\n총 {total}건 추가 수정")
if remaining:
    print("남은 중복:")
    for r in remaining:
        print(f"  '{r[0]}' <- [{r[1]}]")
else:
    print("남은 중복 없음! ✅")

conn.close()
