import importlib.util
import io
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('cnm_server', Path(__file__).resolve().parents[1] / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class UploadTests(unittest.TestCase):
    def request(self, data, mime='image/png', length=None, origin='http://localhost:8000', video=False):
        handler = server.Handler.__new__(server.Handler)
        handler.headers = {'Content-Type': mime, 'Content-Length': str(len(data) if length is None else length), 'Host': 'localhost:8000', 'Origin': origin}
        handler.rfile = io.BytesIO(data)
        result = []
        handler.send_json = lambda payload, status=200: result.append((status, payload))
        handler.upload_image(video=video)
        return result[0]

    def test_local_upload_and_validation(self):
        with TemporaryDirectory() as folder, patch.object(server, 'ROOT', Path(folder)), patch.dict(os.environ, {'SUPABASE_URL': '', 'SUPABASE_PUBLISHABLE_KEY': ''}):
            png = b'\x89PNG\r\n\x1a\nimage bytes'
            status, payload = self.request(png)
            self.assertEqual(status, 201)
            self.assertEqual((Path(folder) / payload['url'].lstrip('/')).read_bytes(), png)
            self.assertEqual(self.request(b'invalid')[0], 415)
            self.assertEqual(self.request(b'<svg/>', 'image/svg+xml')[0], 415)
            self.assertEqual(self.request(b'', length=6*1024*1024)[0], 413)
            self.assertEqual(self.request(png, origin='https://other.example')[0], 403)
            self.assertEqual(len(list((Path(folder) / 'uploads').iterdir())), 1)

    def test_local_video_upload_and_limits(self):
        with TemporaryDirectory() as folder, patch.object(server, 'ROOT', Path(folder)), patch.dict(os.environ, {'SUPABASE_URL': '', 'SUPABASE_PUBLISHABLE_KEY': ''}):
            body = bytes.fromhex('000000186674797069736f6d0000020069736f6d6d703432')
            status, payload = self.request(body, mime='video/mp4', video=True)
            self.assertEqual(status, 201)
            self.assertTrue(payload['url'].endswith('.mp4'))
            self.assertEqual(self.request(body, mime='video/mp4')[0], 415)
            self.assertEqual(self.request(b'invalid', mime='video/mp4', video=True)[0], 415)
            self.assertEqual(self.request(b'', mime='video/mp4', video=True, length=26*1024*1024)[0], 413)

    def test_supabase_project_cannot_use_local_upload_endpoint(self):
        with patch.dict(os.environ, {'SUPABASE_URL': 'https://example.supabase.co', 'SUPABASE_PUBLISHABLE_KEY': 'configured'}):
            self.assertEqual(self.request(b'\x89PNG\r\n\x1a\n')[0], 403)


if __name__ == '__main__':
    unittest.main()
