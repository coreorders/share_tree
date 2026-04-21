import sqlite3
import json
import os
import requests
from pykrx import stock
from dotenv import load_dotenv

load_dotenv()

DB_PATH = "web/stocks.db"
OUTPUT_PATH = "web/public/data.json"
GAS_URL = os.environ.get("NEXT_PUBLIC_GAS_URL")

def get_overrides():
    if not GAS_URL:
        print("⚠️ GAS_URL not found. Skipping overrides.")
        return []
    try:
        print(f"Fetching overrides from Google Sheets...")
        # Use 'get_overrides' action which is public (no password needed)
        res = requests.get(f"{GAS_URL}?action=get_overrides", timeout=10)
        data = res.json()
        if data.get('error'):
            print(f"⚠️ GAS returned error: {data['error']}. Overrides will be skipped.")
            return []
        return data.get('overrides', [])
    except Exception as e:
        print(f"❌ Failed to fetch overrides: {e}")
        return []

def get_market_map():
    print("Fetching KOSPI/KOSDAQ ticker list to determine market type...")
    market_map = {}
    for ticker in stock.get_market_ticker_list(market="KOSPI"):
        market_map[ticker] = "KOSPI"
    for ticker in stock.get_market_ticker_list(market="KOSDAQ"):
        market_map[ticker] = "KOSDAQ"
    return market_map

def export_to_json():
    print(f"Reading data from {DB_PATH} ...")
    if not os.path.exists(DB_PATH):
        print(f"Error: Database {DB_PATH} does not exist.")
        return

    market_map = get_market_map()
    overrides = get_overrides()
    
    # Pre-process overrides for quick lookup
    # 1. DELETE_LINK: (SourceLabel, TargetLabel)
    # 2. MERGE_ALIAS: alias_name -> canonical_id mapping
    delete_rules = set()
    alias_map = {}
    def base_clean(name):
        return name.replace('(주)', '').replace('㈜', '').replace('주식회사', '').replace(' ', '').strip()

    for o in overrides:
        if len(o) >= 4:
            if o[1] == 'DELETE_LINK':
                src = base_clean(o[2])
                tgt = base_clean(o[3])
                delete_rules.add((src, tgt))
            elif o[1] == 'MERGE_ALIAS':
                src = base_clean(o[2])
                tgt = base_clean(o[3])
                alias_map[src] = tgt

    # Hardcoded alias rules for common entity merges
    # 국민연금 variants -> 국민연금
    alias_map['국민연금공단'] = '국민연금'
    alias_map['국민연금기금'] = '국민연금'
    # 정부 variants -> 대한민국정부
    alias_map['기획재정부'] = '대한민국정부'
    alias_map['정부'] = '대한민국정부'
    alias_map['정부(산업통상자원부)'] = '대한민국정부'
    alias_map['정부(산업통산자원부)'] = '대한민국정부'

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM companies")
    companies = cursor.fetchall()
    
    nodes_dict = {}
    # Helper to clean names: remove (주), ㈜, 주식회사 and all spaces, then apply alias mapping
    def clean_name(name):
        n = base_clean(name)
        return alias_map.get(n, n)

    for c in companies:
        c_dict = dict(c)
        stock_code = c_dict.get('stock_code')
        corp_name = c_dict.get('corp_name')
        market = market_map.get(stock_code, "UNKNOWN")
        
        # Aggressive normalization
        normalized_name = clean_name(corp_name)
        
        # If this normalized name already exists (merged), we might want to preserve 
        # the listed status or other more important metadata
        if normalized_name in nodes_dict:
            existing = nodes_dict[normalized_name]
            # Update to higher market cap or listed status if available
            if c_dict.get('market_cap', 0) > existing.get('market_cap', 0):
                existing.update({
                    "id": c_dict.get('corp_code') or normalized_name,
                    "stock_code": stock_code,
                    "market_cap": c_dict.get('market_cap', 0),
                    "close_price": c_dict.get('close_price', 0),
                    "price_change": c_dict.get('price_change', 0),
                    "change_rate": c_dict.get('change_rate', 0),
                    "shares_outstanding": c_dict.get('shares_outstanding', 0),
                    "market": market
                })
            if (c_dict.get('close_price', 0) > 0):
                existing["isListed"] = True
            continue

        # Use normalized_name for both ID and Label to ensure consistent merging and naming
        node_id = c_dict.get('corp_code') or normalized_name
        
        nodes_dict[normalized_name] = {
            "id": node_id,
            "label": normalized_name, # Use normalized name as label
            "stock_code": stock_code,
            "market_cap": c_dict.get('market_cap', 0),
            "close_price": c_dict.get('close_price', 0),
            "price_change": c_dict.get('price_change', 0),
            "change_rate": c_dict.get('change_rate', 0),
            "shares_outstanding": c_dict.get('shares_outstanding', 0),
            "last_updated": c_dict.get('last_updated', ''),
            "isCompany": True,
            "isListed": (c_dict.get('close_price', 0) > 0),
            "market": market
        }

    cursor.execute("""
        SELECT s.*, c.corp_name as target_corp_name 
        FROM shareholders s
        JOIN companies c ON s.target_corp_code = c.corp_code
        WHERE s.shareholder_name != '계'
    """)
    shareholders = cursor.fetchall()
    
    links = []
    for s in shareholders:
        s_dict = dict(s)
        source_name = s_dict['shareholder_name']
        target_code = s_dict['target_corp_code']
        target_name = s_dict['target_corp_name']
        share_rate = s_dict['share_rate']
        
        if not share_rate or share_rate <= 0:
            continue
            
        # Normalize for override check
        n_src = clean_name(source_name)
        n_tgt = clean_name(target_name)
        
        if (n_src, n_tgt) in delete_rules:
            print(f"[REMOVED] Override link: {source_name} -> {target_name}")
            continue

        normalized_source = clean_name(source_name)
        if normalized_source not in nodes_dict:
            nodes_dict[normalized_source] = {
                "id": normalized_source, # Use normalized as ID
                "label": normalized_source,  # Use canonical name as label
                "isCompany": False,
                "isListed": False,
                "market": "NONE"
            }
        
        # Get the canonical ID from nodes_dict
        source_node_id = nodes_dict[normalized_source]["id"]
        
        # Find the target node ID (it might have been normalized too)
        normalized_target = clean_name(target_name)
        target_node_id = nodes_dict.get(normalized_target, {}).get("id", target_code)

        links.append({
            "source": source_node_id,
            "target": target_node_id,
            "value": share_rate,
            "shares_count": s_dict.get('shares_count', 0),
            "label": f"{share_rate}%"
        })

    # Fetch and add subsidiaries
    cursor.execute("""
        SELECT s.*, c.corp_name as source_corp_name 
        FROM subsidiaries s
        JOIN companies c ON s.corp_code = c.corp_code
    """)
    subsidiaries = cursor.fetchall()

    for s in subsidiaries:
        s_dict = dict(s)
        source_code = s_dict['corp_code']
        source_name = s_dict['source_corp_name']
        target_name = s_dict['subsidiary_name']
        share_rate = s_dict['share_rate']
        reason = s_dict.get('reason', '')
        
        if not share_rate or share_rate <= 0:
            continue
            
        # Check override delete rules (direction is source -> target)
        n_src = clean_name(source_name)
        n_tgt = clean_name(target_name)
        
        if (n_src, n_tgt) in delete_rules:
            print(f"[REMOVED] Override subsidiary link: {source_name} -> {target_name}")
            continue

        normalized_target = clean_name(target_name)
        if normalized_target not in nodes_dict:
            nodes_dict[normalized_target] = {
                "id": normalized_target, # Use normalized as ID
                "label": target_name.replace(' ', '').strip(),
                "isCompany": True, # Subsidiaries are companies
                "isListed": False,
                "market": "NONE"
            }
        
        target_node_id = nodes_dict[normalized_target]["id"]
        
        # Source must be the listed company already in nodes_dict
        normalized_source = clean_name(source_name)
        source_node_id = nodes_dict.get(normalized_source, {}).get("id", source_code)

        label_text = f"[{reason}] {share_rate}%" if reason else f"{share_rate}%"

        links.append({
            "source": source_node_id,
            "target": target_node_id,
            "value": share_rate,
            "shares_count": s_dict.get('shares_count', 0),
            "label": label_text,
            "isSubsidiary": True
        })

    # Fetch compensations and attach to nodes
    cursor.execute("""
        SELECT c.*, cp.corp_name 
        FROM compensations c
        JOIN companies cp ON c.corp_code = cp.corp_code
    """)
    comps = cursor.fetchall()
    
    for c in comps:
        c_dict = dict(c)
        corp_name = clean_name(c_dict['corp_name'])
        if corp_name in nodes_dict:
            if 'compensations' not in nodes_dict[corp_name]:
                nodes_dict[corp_name]['compensations'] = []
            nodes_dict[corp_name]['compensations'].append({
                "name": c_dict['name'],
                "position": c_dict['position'],
                "amount_str": c_dict['amount_str'],
                "amount_num": c_dict['amount_num']
            })

    # Fetch executives and attach to nodes
    cursor.execute("""
        SELECT e.*, cp.corp_name 
        FROM executives e
        JOIN companies cp ON e.corp_code = cp.corp_code
    """)
    execs = cursor.fetchall()
    
    for e in execs:
        e_dict = dict(e)
        corp_name = clean_name(e_dict['corp_name'])
        if corp_name in nodes_dict:
            if 'executives' not in nodes_dict[corp_name]:
                nodes_dict[corp_name]['executives'] = []
            nodes_dict[corp_name]['executives'].append({
                "name": e_dict['name'],
                "position": e_dict['position'],
                "birth_ym": e_dict['birth_ym'],
                "is_registered": e_dict['is_registered'],
                "career": e_dict['career'],
                "responsibilities": e_dict['responsibilities']
            })
            
            # Also track position for the person node - store ALL positions with company context
            n_name = clean_name(e_dict['name'])
            if n_name in nodes_dict and not nodes_dict[n_name]['isCompany']:
                if 'positions' not in nodes_dict[n_name]:
                    nodes_dict[n_name]['positions'] = []
                nodes_dict[n_name]['positions'].append({
                    "company": e_dict['corp_name'],
                    "position": e_dict['position']
                })
                # Set the primary position only if not already set
                if 'position' not in nodes_dict[n_name]:
                    nodes_dict[n_name]['position'] = e_dict['position']

    # Fetch dividends and attach to nodes
    cursor.execute("""
        SELECT d.*, cp.corp_name 
        FROM dividends d
        JOIN companies cp ON d.corp_code = cp.corp_code
    """)
    for row in cursor.fetchall():
        d = dict(row)
        cn = clean_name(d['corp_name'])
        if cn in nodes_dict:
            if 'dividends' not in nodes_dict[cn]:
                nodes_dict[cn]['dividends'] = []
            nodes_dict[cn]['dividends'].append({
                "se": d['se'], "stock_knd": d.get('stock_knd', ''),
                "thstrm": d['thstrm'], "frmtrm": d['frmtrm'], "lwfr": d['lwfr']
            })

    # Fetch major shareholder changes and attach to nodes
    cursor.execute("""
        SELECT m.*, cp.corp_name 
        FROM major_shareholder_changes m
        JOIN companies cp ON m.corp_code = cp.corp_code
        ORDER BY m.change_on DESC
    """)
    for row in cursor.fetchall():
        d = dict(row)
        cn = clean_name(d['corp_name'])
        if cn in nodes_dict:
            if 'majorChanges' not in nodes_dict[cn]:
                nodes_dict[cn]['majorChanges'] = []
            nodes_dict[cn]['majorChanges'].append({
                "name": d['mxmm_shrholdr_nm'], "date": d['change_on'],
                "shares": d['posesn_stock_co'], "rate": d['qota_rt'],
                "cause": d['change_cause']
            })

    # Fetch insider trades (exec_shareholder_reports) and attach to nodes
    cursor.execute("""
        SELECT r.*, cp.corp_name 
        FROM exec_shareholder_reports r
        JOIN companies cp ON r.corp_code = cp.corp_code
        ORDER BY r.rcept_dt DESC
    """)
    for row in cursor.fetchall():
        d = dict(row)
        cn = clean_name(d['corp_name'])
        if cn in nodes_dict:
            if 'insiderTrades' not in nodes_dict[cn]:
                nodes_dict[cn]['insiderTrades'] = []
            nodes_dict[cn]['insiderTrades'].append({
                "name": d['repror'], "position": d['isu_exctv_ofcps'],
                "regType": d['isu_exctv_rgist_at'],
                "holdCnt": d['sp_stock_lmp_cnt'], "changeCnt": d['sp_stock_lmp_irds_cnt'],
                "date": d['rcept_dt']
            })
            # Also track position for the person node
            n_name = clean_name(d['repror'])
            if n_name in nodes_dict and not nodes_dict[n_name]['isCompany']:
                if 'position' not in nodes_dict[n_name]:
                    nodes_dict[n_name]['position'] = d['isu_exctv_ofcps']

    # Fetch treasury shares and attach to nodes
    cursor.execute("""
        SELECT t.*, cp.corp_name 
        FROM treasury_shares t
        JOIN companies cp ON t.corp_code = cp.corp_code
    """)
    for row in cursor.fetchall():
        d = dict(row)
        cn = clean_name(d['corp_name'])
        if cn in nodes_dict:
            if 'treasuryShares' not in nodes_dict[cn]:
                nodes_dict[cn]['treasuryShares'] = []
            nodes_dict[cn]['treasuryShares'].append({
                "stockKnd": d['stock_knd'], "bsisQy": d['bsis_qy'],
                "acqs": d['change_qy_acqs'], "dsps": d['change_qy_dsps'],
                "trmendQy": d['trmend_qy']
            })

    # Compute insiderSignal for ink bleed effect
    for cn, node in nodes_dict.items():
        trades = node.get('insiderTrades', [])
        if not trades:
            continue
        has_buy = any(t.get('changeCnt', 0) > 0 for t in trades)
        has_sell = any(t.get('changeCnt', 0) < 0 for t in trades)
        if has_buy and has_sell:
            node['insiderSignal'] = 'both'
        elif has_buy:
            node['insiderSignal'] = 'buy'
        elif has_sell:
            node['insiderSignal'] = 'sell'

    export_data = {
        "nodes": list(nodes_dict.values()),
        "links": links,
        "updated_at": "import datetime; datetime.datetime.now().isoformat()" # Placeholder
    }
    import datetime
    export_data['updated_at'] = datetime.datetime.now().isoformat()

    print(f"Exporting {len(export_data['nodes'])} nodes and {len(export_data['links'])} links...")
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
        
    print(f"[SUCCESS] Data exported to {OUTPUT_PATH}")
    
    # Calculate file size
    size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"File size: {size_mb:.2f} MB")

if __name__ == "__main__":
    export_to_json()
