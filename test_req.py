import requests, os, json
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv('DART_API_KEY')
print("API Key loaded:", bool(API_KEY))

# 타법인출자현황
res1 = requests.get('https://opendart.fss.or.kr/api/otrCprInvstmntSttus.json', params={'crtfc_key': API_KEY, 'corp_code': '00126380', 'bsns_year': '2023', 'reprt_code': '11011'})
with open('test_dart1.json', 'w', encoding='utf-8') as f:
    json.dump(res1.json(), f, ensure_ascii=False, indent=2)
print("Saved test_dart1.json")

# 임원현황
res2 = requests.get('https://opendart.fss.or.kr/api/excutvSttus.json', params={'crtfc_key': API_KEY, 'corp_code': '00126380', 'bsns_year': '2023', 'reprt_code': '11011'})
with open('test_dart2.json', 'w', encoding='utf-8') as f:
    json.dump(res2.json(), f, ensure_ascii=False, indent=2)
print("Saved test_dart2.json")
