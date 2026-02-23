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
        res = requests.get(f"{GAS_URL}?action=get_data", timeout=10)
        data = res.json()
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
    
    # Pre-process overrides for quick lookup: (Type, SourceLabel, TargetLabel)
    # Normalize labels in rules as well
    delete_rules = set()
    for o in overrides:
        if len(o) >= 4 and o[1] == 'DELETE_LINK':
            # Remove spaces for matching
            src = o[2].replace(' ', '').strip()
            tgt = o[3].replace(' ', '').strip()
            delete_rules.add((src, tgt))

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM companies")
    companies = cursor.fetchall()
    
    nodes_dict = {}
    for c in companies:
        c_dict = dict(c)
        stock_code = c_dict.get('stock_code')
        corp_name = c_dict.get('corp_name')
        market = market_map.get(stock_code, "UNKNOWN")
        # Stronger normalization: remove ALL spaces
        normalized_name = corp_name.replace('(주)', '').replace(' ', '').strip()
        
        nodes_dict[normalized_name] = {
            "id": c_dict.get('corp_code'),
            "label": corp_name,
            "stock_code": stock_code,
            "market_cap": c_dict.get('market_cap', 0),
            "close_price": c_dict.get('close_price', 0),
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
        n_src = source_name.replace(' ', '').strip()
        n_tgt = target_name.replace(' ', '').strip()
        
        if (n_src, n_tgt) in delete_rules:
            print(f"🚫 Removing override link: {source_name} -> {target_name}")
            continue

        normalized_source = source_name.replace('(주)', '').replace(' ', '').strip()
        if normalized_source not in nodes_dict:
            nodes_dict[normalized_source] = {
                "id": source_name,
                "label": source_name,
                "isCompany": False,
                "isListed": False,
                "market": "NONE"
            }
            
        links.append({
            "source": nodes_dict[normalized_source]["id"],
            "target": target_code,
            "value": share_rate,
            "shares_count": s_dict.get('shares_count', 0),
            "label": f"{share_rate}%"
        })

    # Prepare final JSON
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
        
    print(f"✅ Success! Data exported to {OUTPUT_PATH}")
    
    # Calculate file size
    size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"File size: {size_mb:.2f} MB")

if __name__ == "__main__":
    export_to_json()
