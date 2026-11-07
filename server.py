#!/usr/bin/env python3
"""Small first-party server for the Casal no Mundo page and anonymous reports."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from datetime import date
from pathlib import Path
import json
import os
import threading
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "conteudo.json"
ANALYTICS_FILE = ROOT / "analytics.json"
LOCK = threading.Lock()

for env_file in (ROOT / ".env.local", ROOT / ".env"):
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def read_analytics():
    try:
        return json.loads(ANALYTICS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"visits": {}, "clicks": {}, "locations": {}}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *_args):
        # Do not write visitor IP addresses to the server log.
        pass

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self, max_size=100_000):
        size = int(self.headers.get("Content-Length", "0"))
        if size < 1 or size > max_size:
            raise ValueError("invalid body size")
        return json.loads(self.rfile.read(size).decode("utf-8"))

    def do_GET(self):
        route = urlparse(self.path).path
        if route in ("/painel", "/painel.html", "/admin/"):
            self.send_response(302)
            self.send_header("Location", "/admin")
            self.end_headers()
            return
        if route == "/admin":
            self.path = "/painel.html"
            super().do_GET()
            return
        if route == "/api/config":
            self.send_json({
                "supabaseUrl": os.environ.get("SUPABASE_URL", ""),
                "supabasePublishableKey": os.environ.get("SUPABASE_PUBLISHABLE_KEY", ""),
            })
            return
        if route == "/api/content":
            try:
                self.send_json(json.loads(DATA_FILE.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                self.send_json({"error": "content unavailable"}, 500)
            return
        if route == "/api/analytics":
            with LOCK:
                data = read_analytics()
            clicks = data.get("clicks", {})
            visits = data.get("visits", {})
            sections = data.get("sections", {})
            locations = list(data.get("locations", {}).values())
            self.send_json({
                "totalVisits": sum(visits.values()),
                "visitsByDay": visits,
                "totalClicks": sum(item.get("count", 0) for item in clicks.values()),
                "clicks": sorted(clicks.values(), key=lambda x: x.get("count", 0), reverse=True),
                "sections": sorted(sections.values(), key=lambda x: x.get("count", 0), reverse=True),
                "locations": locations,
            })
            return
        if route == "/api/health":
            self.send_json({"status": "ok"})
            return
        super().do_GET()

    def do_POST(self):
        route = urlparse(self.path).path
        try:
            payload = self.read_body(4_000)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self.send_json({"error": "invalid request"}, 400)
            return
        today = date.today().isoformat()
        with LOCK:
            data = read_analytics()
            if route == "/api/track":
                event_type = payload.get("type")
                if event_type == "visit":
                    visits = data.setdefault("visits", {})
                    visits[today] = visits.get(today, 0) + 1
                elif event_type == "click":
                    event_id = str(payload.get("id", ""))[:80]
                    if not event_id:
                        self.send_json({"error": "missing id"}, 400)
                        return
                    clicks = data.setdefault("clicks", {})
                    item = clicks.setdefault(event_id, {"id": event_id, "label": str(payload.get("label", "Link"))[:120], "count": 0, "days": {}})
                    item["label"] = str(payload.get("label", item.get("label", "Link")))[:120]
                    item["count"] = item.get("count", 0) + 1
                    days = item.setdefault("days", {})
                    days[today] = days.get(today, 0) + 1
                elif event_type == "section":
                    section_id = str(payload.get("id", ""))[:80]
                    if not section_id:
                        self.send_json({"error": "missing section id"}, 400)
                        return
                    sections = data.setdefault("sections", {})
                    item = sections.setdefault(section_id, {"id": section_id, "label": str(payload.get("label", "Seção"))[:120], "count": 0, "days": {}})
                    item["label"] = str(payload.get("label", item.get("label", "Seção")))[:120]
                    item["count"] = item.get("count", 0) + 1
                    days = item.setdefault("days", {})
                    days[today] = days.get(today, 0) + 1
                else:
                    self.send_json({"error": "unsupported event"}, 400)
                    return
            elif route == "/api/location":
                try:
                    lat, lon = float(payload["lat"]), float(payload["lon"])
                except (KeyError, TypeError, ValueError):
                    self.send_json({"error": "invalid coordinates"}, 400)
                    return
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    self.send_json({"error": "invalid coordinates"}, 400)
                    return
                # Coordinates arrive rounded to one decimal by the page (~10 km).
                key = f"{lat:.1f},{lon:.1f}"
                locations = data.setdefault("locations", {})
                item = locations.setdefault(key, {"lat": round(lat, 1), "lon": round(lon, 1), "count": 0})
                item["count"] = item.get("count", 0) + 1
                item["lastSeen"] = today
            else:
                self.send_json({"error": "not found"}, 404)
                return
            ANALYTICS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.send_json({"ok": True}, 201)

    def do_PUT(self):
        if urlparse(self.path).path != "/api/content":
            self.send_json({"error": "not found"}, 404)
            return
        try:
            content = self.read_body(250_000)
            if not isinstance(content, dict) or not isinstance(content.get("profile"), dict):
                raise ValueError("invalid content")
            serialized = json.dumps(content, ensure_ascii=False, indent=2) + "\n"
            with LOCK:
                DATA_FILE.write_text(serialized, encoding="utf-8")
                # Keep local-file fallback in sync for the project preview.
                fallback = "window.CNM_DEFAULT_DATA = " + json.dumps(content, ensure_ascii=False, indent=2) + ";\n"
                (ROOT / "defaults.js").write_text(fallback, encoding="utf-8")
            self.send_json({"ok": True})
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self.send_json({"error": "invalid content"}, 400)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Casal no Mundo local: http://127.0.0.1:{port}/admin", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
