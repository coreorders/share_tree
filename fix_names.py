import sqlite3
import re

conn = sqlite3.connect('stocks.db')
c = conn.cursor()

# =========================================================
# 1. Normalize ALL person names: remove internal spaces
#    e.g. "이 재 용" → "이재용", "김     량" → "김량"
# =========================================================
print("=== 1. 개인 이름 공백 정규화 ===")

# Get all unique shareholder names
all_names = c.execute("SELECT DISTINCT shareholder_name FROM shareholders").fetchall()
space_fixes = 0

for (name,) in all_names:
    stripped = name.strip()  # trim leading/trailing
    # Remove ALL whitespace from short Korean-only names (likely person names)
    # Korean name: 2-5 chars when spaces removed, contains Korean
    no_space = re.sub(r'\s+', '', stripped)
    
    # Only normalize if it's a Korean person name (2-5 chars, all Korean)
    is_korean_person = bool(re.match(r'^[가-힣]{2,5}$', no_space)) and ' ' in stripped
    
    # Also handle names wrapped in parentheses like (윤 경 희)
    is_paren_name = bool(re.match(r'^\([가-힣\s]{2,}\)$', stripped))
    if is_paren_name:
        no_space = re.sub(r'\s+', '', stripped)
    
    if is_korean_person or is_paren_name:
        if stripped != no_space:
            c.execute(
                "UPDATE shareholders SET shareholder_name = ? WHERE shareholder_name = ?",
                (no_space, name)
            )
            space_fixes += c.rowcount
            print(f"  '{name}' → '{no_space}'")

    # Also trim trailing/leading whitespace from all names
    elif stripped != name:
        c.execute(
            "UPDATE shareholders SET shareholder_name = ? WHERE shareholder_name = ?",
            (stripped, name)
        )
        space_fixes += c.rowcount
        print(f"  trim: '{name}' → '{stripped}'")

print(f"  공백 정규화: {space_fixes}건 수정\n")

# =========================================================
# 2. Normalize specific entity aliases
# =========================================================
print("=== 2. 엔티티 별칭 통합 ===")

alias_map = {
    # 정부 관련
    '정부': '대한민국정부',
    '기획재정부': '대한민국정부',
    
    # 국민연금 관련
    '국민연금': '국민연금공단',
    '국민연금기금': '국민연금공단',
    
    # 현대차 정몽구 재단
    '현대차 정몽구 재단': '현대차정몽구재단',
    '현대차 정몽구재단': '현대차정몽구재단',
    
    # 자기주식 관련
    '자기주식': '자사주',
}

alias_fixes = 0
for old_name, new_name in alias_map.items():
    c.execute(
        "UPDATE shareholders SET shareholder_name = ? WHERE shareholder_name = ?",
        (new_name, old_name)
    )
    if c.rowcount > 0:
        alias_fixes += c.rowcount
        print(f"  '{old_name}' → '{new_name}' ({c.rowcount}건)")

print(f"  별칭 통합: {alias_fixes}건 수정\n")

# =========================================================
# 3. Fix company name variations with (주), ㈜, newlines
# =========================================================
print("=== 3. 줄바꿈/공백 포함된 이름 정리 ===")
newline_names = c.execute("""
    SELECT DISTINCT shareholder_name FROM shareholders
    WHERE shareholder_name LIKE '%\n%' OR shareholder_name LIKE '%\r%'
""").fetchall()

nl_fixes = 0
for (name,) in newline_names:
    cleaned = re.sub(r'[\r\n]+\s*', '', name).strip()
    if cleaned != name:
        c.execute(
            "UPDATE shareholders SET shareholder_name = ? WHERE shareholder_name = ?",
            (cleaned, name)
        )
        nl_fixes += c.rowcount
        print(f"  줄바꿈 제거: '{repr(name)}' → '{cleaned}'")

print(f"  줄바꿈 정리: {nl_fixes}건 수정\n")

# =========================================================
# 4. After all fixes, check remaining duplicates
# =========================================================
print("=== 최종 확인: 남은 중복 ===")
remaining = c.execute("""
    SELECT REPLACE(shareholder_name, ' ', '') as normalized,
           GROUP_CONCAT(DISTINCT shareholder_name) as variants,
           COUNT(DISTINCT shareholder_name) as cnt
    FROM shareholders
    GROUP BY normalized
    HAVING cnt > 1
    ORDER BY cnt DESC
    LIMIT 20
""").fetchall()

if remaining:
    for r in remaining:
        print(f"  '{r[0]}' ← [{r[1]}]")
else:
    print("  중복 없음! ✅")

conn.commit()
conn.close()

print(f"\n✅ 완료! 총 {space_fixes + alias_fixes + nl_fixes}건 수정됨")
