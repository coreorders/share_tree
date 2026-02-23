import sqlite3

conn = sqlite3.connect('stocks.db')
c = conn.cursor()

# Count total duplicates first
dups = c.execute("""
    SELECT shareholder_name, target_corp_code, COUNT(*) as cnt
    FROM shareholders
    WHERE shareholder_name != '계'
    GROUP BY shareholder_name, target_corp_code
    HAVING cnt > 1
""").fetchall()

print(f"중복 쌍: {len(dups)}건")

# For each duplicate pair, keep only the row with the highest share_rate (or largest rowid as tiebreaker)
deleted = 0
for name, corp_code, cnt in dups:
    # Get all rows for this pair
    rows = c.execute("""
        SELECT rowid, share_rate, shares_count
        FROM shareholders
        WHERE shareholder_name = ? AND target_corp_code = ?
        ORDER BY share_rate DESC, shares_count DESC, rowid DESC
    """, (name, corp_code)).fetchall()
    
    # Keep the first one (highest share_rate), delete the rest
    keep_rowid = rows[0][0]
    delete_rowids = [r[0] for r in rows[1:]]
    
    for rid in delete_rowids:
        c.execute("DELETE FROM shareholders WHERE rowid = ?", (rid,))
        deleted += 1
    
    print(f"  {name} → {corp_code}: 유지 rowid={keep_rowid} (rate={rows[0][1]}%), 삭제 {len(delete_rowids)}건")

conn.commit()

# Verify
remaining = c.execute("""
    SELECT COUNT(*) FROM (
        SELECT shareholder_name, target_corp_code, COUNT(*) as cnt
        FROM shareholders
        WHERE shareholder_name != '계'
        GROUP BY shareholder_name, target_corp_code
        HAVING cnt > 1
    )
""").fetchone()[0]

print(f"\n✅ 총 {deleted}건 삭제 완료")
print(f"남은 중복: {remaining}건")

conn.close()
