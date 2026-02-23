import sqlite3
import pandas as pd
import os

db_path = os.path.join(os.path.dirname(__file__), 'web/stocks.db')
excel_path = os.path.join(os.path.dirname(__file__), '국내주식 종목별 투자 현황(2024년 말).xlsx')

def main():
    print("국민연금공단 엑셀 데이터 읽는 중...")
    # skiprows=5 로 헤더 날리고, 6번째 줄을 컬럼명으로 사용
    df = pd.read_excel(excel_path, skiprows=6)
    
    # 엑셀 헤더 확인: ['번호', '종목명', '평가액(억원)', '자산군 내 비중', '지분율']
    # 비어있는 행 제거
    df = df.dropna(subset=['종목명'])
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 임시 테이블로 기업코드 맵 구축 (이름 -> 코드)
    cursor.execute("SELECT corp_name, corp_code FROM companies")
    companies = cursor.fetchall()
    
    name_to_code = {}
    for name, code in companies:
        name_to_code[name] = code
        # 정규화된 이름도 맵핑 (주식회사 떼기 등)
        norm_name = name.replace('(주)', '').replace('㈜', '').replace('주식회사', '').replace(' ', '').replace('-', '').upper().strip()
        name_to_code[norm_name] = code
        
        # '삼성전자우' 처럼 우선주 매칭 보완
        if name.endswith('우선주'):
            name_to_code[name.replace('우선주', '우')] = code
        elif name.endswith('우'):
            name_to_code[name] = code
    
    nps_name = "국민연금공단"
    updated_count = 0
    inserted_count = 0
    not_found_count = 0
    
    for index, row in df.iterrows():
        stock_name = str(row['종목명']).strip()
        share_rate_raw = row['지분율']
        
        # 지분율 숫자가 유효한지 체크
        try:
            # 엑셀 상 지분율이 0.0726 이면 7.26%
            # float 강제 변환 후 100 곱하기
            share_rate = float(share_rate_raw) * 100
        except:
            continue
            
        # 0%는 제외
        if share_rate <= 0:
            continue
            
        norm_stock_name = stock_name.replace('(주)', '').replace('㈜', '').replace('주식회사', '').replace(' ', '').replace('-', '').upper().strip()
        
        corp_code = name_to_code.get(stock_name) or name_to_code.get(norm_stock_name)
        
        if not corp_code:
            print(f"[매칭 실패] DB에서 기업을 찾을 수 없음: {stock_name}")
            not_found_count += 1
            continue
            
        # 기존 DB에 국민연금공단 지분이 있는지 확인
        cursor.execute("SELECT share_rate FROM shareholders WHERE target_corp_code = ? AND shareholder_name = ?", (corp_code, nps_name))
        existing = cursor.fetchone()
        
        if existing:
            # 업데이트
            # (기존 값이 최신 DART 기준일 수도 있으므로, 업데이트 전/후 비교 로직은 선택 사항. 여기선 엑셀 최신 데이터 우선 적용)
            cursor.execute("""
                UPDATE shareholders 
                SET share_rate = ?, shares_count = 0, collected_at = '2024-12-31' 
                WHERE target_corp_code = ? AND shareholder_name = ?
            """, (share_rate, corp_code, nps_name))
            updated_count += 1
        else:
            # 신규 삽입
            cursor.execute("""
                INSERT INTO shareholders (target_corp_code, shareholder_name, share_rate, shares_count, collected_at)
                VALUES (?, ?, ?, ?, ?)
            """, (corp_code, nps_name, share_rate, 0, '2024-12-31'))
            inserted_count += 1
            
    conn.commit()
    conn.close()
    
    print("\n--- 결과 ---")
    print(f"신규 추가된 공단 지분: {inserted_count}건")
    print(f"업데이트된 공단 지분: {updated_count}건")
    print(f"DB 매칭 실패(미상장/이름다름): {not_found_count}건")

if __name__ == "__main__":
    main()
