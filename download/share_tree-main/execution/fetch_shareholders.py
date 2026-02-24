import os
import json
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# DART API 설정
BASE_URL = "https://opendart.fss.or.kr/api/hyslrChgSttus.json" # 최대주주 변동현황
CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"

def get_shareholders(corp_code, api_key):
    """
    DART API를 통해 특정 기업의 최대주주 현황을 가져옵니다.
    """
    params = {
        'crtfc_key': api_key,
        'corp_code': corp_code,
        'last_reprt_at': 'Y' # 최근 보고서 기준
    }
    
    response = requests.get(BASE_URL, params=params)
    data = response.json()
    
    if data.get('status') != '000':
        print(f"Error: {data.get('message')}")
        return None
        
    return data.get('list', [])

def transform_to_graph(corp_name, shareholder_list):
    """
    DART 데이터를 시각화용 Nodes/Links 포맷으로 변환합니다.
    """
    nodes = [{"id": corp_name, "group": 1, "val": 30}]
    links = []
    
    for sh in shareholder_list:
        name = sh.get('nm')
        ratio = sh.get('thstrm_shares_rate') # 지분율 (%)
        
        try:
            val = float(ratio)
        except (ValueError, TypeError):
            val = 0.1
            
        nodes.append({"id": name, "group": 2, "val": max(5, val * 0.5)})
        links.append({
            "source": name,
            "target": corp_name,
            "value": val
        })
        
    return {"nodes": nodes, "links": links}

if __name__ == "__main__":
    # 테스트용: 삼성전자 (00126380)
    SAMSUNG_CORP_CODE = "00126380"
    API_KEY = os.getenv("DART_API_KEY") # 사용자가 .env에 입력해야 함
    
    if not API_KEY or API_KEY == "your_api_key_here":
        print("Warning: DART_API_KEY for .env is missing or placeholder. Generating dummy data for demonstration.")
        # 더미 데이터 생성 시나리오
        dummy_graph = {
            "nodes": [
                {"id": "삼성전자", "group": 1, "val": 30},
                {"id": "삼성생명보험", "group": 2, "val": 15},
                {"id": "삼성물산", "group": 2, "val": 10},
                {"id": "이재용", "group": 2, "val": 5}
            ],
            "links": [
                {"source": "삼성생명보험", "target": "삼성전자", "value": 8.51},
                {"source": "삼성물산", "target": "삼성전자", "value": 5.01},
                {"source": "이재용", "target": "삼성전자", "value": 1.63}
            ]
        }
        output_path = "web/public/data.json"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(dummy_graph, f, ensure_ascii=False, indent=2)
    else:
        shareholders = get_shareholders(SAMSUNG_CORP_CODE, API_KEY)
        if shareholders:
            graph_data = transform_to_graph("삼성전자", shareholders)
            output_path = "web/public/data.json"
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(graph_data, f, ensure_ascii=False, indent=2)
            print(f"Successfully saved data to {output_path}")
