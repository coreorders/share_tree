"""
DART 주주 데이터 재수집 (v3)
- 기업당 API 호출 최소화: 사업보고서(2025) → (2024) 만 시도
- 네이버 시총/주가 포함
- 이름 정규화 + UNIQUE 중복 방지
- 진행 상태 저장 (중단 후 이어서 가능)
"""

import os
import re
import json
import sqlite3
import time
import requests
import zipfile
import io
from xml.etree import ElementTree

DART_API_KEY = '5a84562e31da0f14170bc7d4bdc06568508ab7e1'
DB_PATH = 'web/stocks.db'
PROGRESS_FILE = 'scrape_progress.json'
BASE_URL = 'https://opendart.fss.or.kr/api'

# ── 이름 정규화 ──
ALIAS_MAP = {
    '정부': '대한민국정부', '기획재정부': '대한민국정부',
    '국민연금': '국민연금공단', '국민연금기금': '국민연금공단',
    '자기주식': '자사주',
}

def normalize_name(name: str) -> str:
    if not name: return name
    name = re.sub(r'[\r\n]+\s*', '', name).strip()
    no_space = re.sub(r'\s+', '', name)
    if re.match(r'^[가-힣]{2,5}$', no_space) and ' ' in name:
        name = no_space
    if re.match(r'^\([가-힣\s]{2,}\)$', name):
        name = re.sub(r'\s+', '', name)
    name = name.strip()
    return ALIAS_MAP.get(name, name)


# ── 전체 기업 목록 ──
def fetch_corp_list() -> list:
    print("📥 기업 목록 다운로드...")
    url = f"https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key={DART_API_KEY}"
    res = requests.get(url, timeout=30)
    z = zipfile.ZipFile(io.BytesIO(res.content))
    xml_content = z.read(z.namelist()[0])
    tree = ElementTree.fromstring(xml_content)
    
    corps = []
    for item in tree.findall('.//list'):
        corp_code = item.findtext('corp_code', '')
        stock_code = item.findtext('stock_code', '').strip()
        if corp_code and stock_code:
            corps.append({
                'corp_code': corp_code,
                'corp_name': item.findtext('corp_name', ''),
                'stock_code': stock_code,
            })
    print(f"  ✅ 상장 기업: {len(corps)}개")
    return corps


# ── 네이버 주가/시총 ──
def parse_korean_currency(text: str) -> int:
    if not text: return 0
    import re
    text = text.replace(',', '').replace(' ', '')
    total = 0
    for m in re.finditer(r'([0-9]+)(조|억|만)?', text):
        num = int(m.group(1))
        unit = m.group(2)
        if unit == '조': total += num * 1000000000000
        elif unit == '억': total += num * 100000000
        elif unit == '만': total += num * 10000
        else: total += num
    return total

def fetch_stock_info(stock_code: str) -> dict:
    try:
        r = requests.get(
            f"https://m.stock.naver.com/api/stock/{stock_code}/basic",
            headers={'User-Agent': 'Mozilla/5.0'}, timeout=5
        )
        if r.status_code != 200:
            return {'close_price': 0, 'market_cap': 0, 'shares_outstanding': 0}
            
        d = r.json()
        cp_str = d.get('closePrice') or d.get('stockEndPrice') or '0'
        close_price = int(str(cp_str).replace(',', ''))
        
        # 시총 정보 가져오기 (integration API)
        r2 = requests.get(
            f"https://m.stock.naver.com/api/stock/{stock_code}/integration",
            headers={'User-Agent': 'Mozilla/5.0'}, timeout=5
        )
        market_cap = 0
        if r2.status_code == 200:
            for info in r2.json().get('totalInfos', []):
                if info.get('code') == 'marketValue':
                    market_cap = parse_korean_currency(info.get('value', ''))
                    break
                    
        return {
            'close_price': close_price,
            'market_cap': market_cap,
            'shares_outstanding': int(market_cap / close_price) if close_price > 0 else 0,
        }
    except Exception as e:
        pass
    return {'close_price': 0, 'market_cap': 0, 'shares_outstanding': 0}


# ── DART 최대주주 ──
def fetch_shareholders(corp_code: str) -> list:
    """사업보고서 2024 3분기 → 2024 반기 → 2023 사업보고서 순으로 시도"""
    attempts = [
        ('2024', '11014'),  # 2024 3분기보고서
        ('2024', '11012'),  # 2024 반기보고서
        ('2023', '11011'),  # 2023 사업보고서
    ]
    
    for year, reprt_code in attempts:
        try:
            r = requests.get(f"{BASE_URL}/hyslrSttus.json", params={
                'crtfc_key': DART_API_KEY,
                'corp_code': corp_code,
                'bsns_year': year,
                'reprt_code': reprt_code,
            }, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
            data = r.json()
            
            if data.get('status') == '000':
                holders = {}
                for item in data.get('list', []):
                    name = normalize_name(item.get('nm', ''))
                    if not name or name == '계':
                        continue
                    
                    rate = 0
                    try:
                        rate = float(item.get('trmend_posesn_stock_qota_rt', '0').replace(',', '').replace('-', '0'))
                    except: pass
                    
                    cnt = 0
                    try:
                        cnt = int(item.get('trmend_posesn_stock_co', '0').replace(',', '').replace('-', '0'))
                    except: pass
                    
                    if name not in holders or rate > holders[name]['share_rate']:
                        holders[name] = {'name': name, 'share_rate': rate, 'shares_count': cnt}
                
                return list(holders.values())
            
            # '013' = 조회된 데이터 없음 → 다음 시도
            if data.get('status') == '013':
                continue
            
            # rate limit or error → 잠시 대기 후 다음
            time.sleep(1)
            
        except requests.exceptions.Timeout:
            time.sleep(2)
        except Exception as e:
            time.sleep(0.5)
    
    return []


# ── 메인 ──
def main():
    corps = fetch_corp_list()
    if not corps:
        return
    
    # 진행 상태 로드
    done_set = set()
    if os.path.exists(PROGRESS_FILE):
        done_set = set(json.load(open(PROGRESS_FILE)))
        print(f"  이어서 재개: {len(done_set)}개 완료됨")
    
    # DB 초기화 (첫 실행 시에만)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS companies (
        corp_code TEXT PRIMARY KEY, stock_code TEXT, corp_name TEXT, 
        last_updated DATETIME, market_cap INTEGER DEFAULT 0, 
        shares_outstanding INTEGER DEFAULT 0, close_price INTEGER DEFAULT 0
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS shareholders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, target_corp_code TEXT, 
        shareholder_name TEXT, share_rate REAL DEFAULT 0, 
        shares_count INTEGER DEFAULT 0, collected_at DATETIME,
        UNIQUE(shareholder_name, target_corp_code)
    )""")
    c.execute("CREATE INDEX IF NOT EXISTS idx_sh_target ON shareholders(target_corp_code)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_sh_name ON shareholders(shareholder_name)")
    conn.commit()
    
    total = len(corps)
    remaining = [c_item for c_item in corps if c_item['corp_code'] not in done_set]
    success = 0
    fail = 0
    
    print(f"\n🚀 처리할 기업: {len(remaining)}/{total}개\n")
    
    for i, corp in enumerate(remaining):
        cc = corp['corp_code']
        cn = corp['corp_name']
        sc = corp['stock_code']
        
        if (i + 1) % 50 == 0 or i == 0:
            print(f"[{i+1}/{len(remaining)}] {cn} (성공:{success} 실패:{fail})")
        
        # 1. 네이버 주가
        si = fetch_stock_info(sc)
        c.execute("INSERT OR REPLACE INTO companies (corp_code, stock_code, corp_name, last_updated, market_cap, shares_outstanding, close_price) VALUES (?,?,?,datetime('now'),?,?,?)",
                  (cc, sc, cn, si['market_cap'], si['shares_outstanding'], si['close_price']))
        
        if si['close_price'] == 0:
            # 상장폐지/비상장/거래정지 등으로 현재가가 없는 경우 DART API 호출 스킵 (한도 절약)
            fail += 1
            done_set.add(cc)
            continue
            
        # 2. DART 최대주주
        shs = fetch_shareholders(cc)
        for sh in shs:
            c.execute("INSERT OR REPLACE INTO shareholders (target_corp_code, shareholder_name, share_rate, shares_count, collected_at) VALUES (?,?,?,?,datetime('now'))",
                      (cc, sh['name'], sh['share_rate'], sh['shares_count']))
        
        if shs:
            success += 1
        else:
            fail += 1
        
        # 진행 저장
        done_set.add(cc)
        if (i + 1) % 10 == 0:
            conn.commit()
            with open(PROGRESS_FILE, 'w') as f:
                json.dump(list(done_set), f)
        
        time.sleep(0.3)  # DART rate limit 대비 (분당 200건)
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ 완료! 성공:{success} 실패:{fail}/{total}")
    print(f"  DB: {DB_PATH}")
    print(f"  완료 후 stocks.db로 교체: copy {DB_PATH} stocks.db")


if __name__ == '__main__':
    main()
