import requests, os, json
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv('DART_API_KEY')

# 삼성전자 00126380, 카카오 00258801
corp_code = '00126380'
year = '2023'
reprt = '11011'

endpoints = {
    "A_large_holdings": "https://opendart.fss.or.kr/api/elestock.json",
    "B_exec_holdings": "https://opendart.fss.or.kr/api/elestock.json",
    "C_treasury": "https://opendart.fss.or.kr/api/tesstkAcqsDspsSttus.json",
    "D_dividends": "https://opendart.fss.or.kr/api/alotMatter.json"
}

for name, url in endpoints.items():
    print(f"Fetching {name}...")
    res = requests.get(url, params={'crtfc_key': API_KEY, 'corp_code': corp_code, 'bsns_year': year, 'reprt_code': reprt})
    with open(f'test_{name}.json', 'w', encoding='utf-8') as f:
        json.dump(res.json(), f, ensure_ascii=False, indent=2)
    print(f"Saved test_{name}.json")
