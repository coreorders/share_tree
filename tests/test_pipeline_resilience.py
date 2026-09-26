import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import requests

import export_json
from execution import fetch_weekly_all as weekly


class MarketCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.cache = root / 'market-map.json'
        self.output = root / 'data.json'
        self.cache.write_text(json.dumps({'005930': 'KOSPI'}))
        self.output.write_text(json.dumps({'nodes': [
            {'stock_code': '005930', 'market': 'UNKNOWN'},
            {'stock_code': '123456', 'market': 'KOSDAQ'},
        ]}))
        patches = patch.multiple(export_json, MARKET_CACHE_PATH=str(self.cache),
                                 OUTPUT_PATH=str(self.output))
        patches.start()
        self.addCleanup(patches.stop)

    def test_import_failure_preserves_labels(self):
        with patch.dict(sys.modules, {'pykrx': None}):
            result = export_json.get_market_map()
        self.assertEqual(result, {'005930': 'KOSPI', '123456': 'KOSDAQ'})

    def test_partial_market_response_does_not_replace_cache(self):
        stock = Mock()
        stock.get_market_ticker_list.side_effect = [list(map(str, range(100))), []]
        with patch.dict(sys.modules, {'pykrx': SimpleNamespace(stock=stock)}):
            result = export_json.get_market_map()
        self.assertEqual(result['005930'], 'KOSPI')
        self.assertNotIn('0', result)

    def test_complete_response_refreshes_cache(self):
        stock = Mock()
        stock.get_market_ticker_list.side_effect = [list(map(str, range(100))),
                                                   list(map(str, range(100, 200)))]
        with patch.dict(sys.modules, {'pykrx': SimpleNamespace(stock=stock)}):
            result = export_json.get_market_map()
        self.assertEqual(len(result), 200)
        self.assertEqual(result['100'], 'KOSDAQ')
        self.assertEqual(json.loads(self.cache.read_text()), result)


class DartResponseTests(unittest.TestCase):
    def response(self, status, rows=None):
        response = Mock()
        response.json.return_value = {'status': status, 'list': rows or []}
        return response

    def test_success_and_no_data(self):
        for status, expected in [('000', [{'value': 1}]), ('013', [])]:
            with patch.object(weekly.requests, 'get', return_value=self.response(status, expected)):
                self.assertEqual(weekly.request_dart('https://example.test', {'corp_code': '1'}), expected)

    def test_api_errors_are_not_treated_as_empty_data(self):
        for status in ['010', '020', '800', '900']:
            with patch.object(weekly.requests, 'get', return_value=self.response(status)):
                with self.assertRaisesRegex(RuntimeError, status):
                    weekly.request_dart('https://example.test', {'corp_code': '1'})

    def test_network_errors_retry_without_leaking_credentials(self):
        with patch.object(weekly.requests, 'get', side_effect=requests.Timeout('secret-key')) as get:
            with patch.object(weekly.time, 'sleep'):
                with self.assertRaises(RuntimeError) as error:
                    weekly.request_dart('https://example.test', {'corp_code': '1', 'crtfc_key': 'secret-key'})
        self.assertEqual(get.call_count, 3)
        self.assertNotIn('secret-key', str(error.exception))

    def test_missing_key_fails(self):
        with patch.object(weekly, 'API_KEY', None):
            with self.assertRaisesRegex(RuntimeError, 'DART_API_KEY'):
                weekly.fetch_dart_equity_disclosures('https://example.test', '1')


if __name__ == '__main__':
    unittest.main()
