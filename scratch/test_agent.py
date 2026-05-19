import requests, time

API = "https://sistema-jose-giro-api-server.vercel.app"

print("Sending heartbeat...")
try:
    r = requests.post(f"{API}/api/impressoes/heartbeat", timeout=5)
    print("Heartbeat status:", r.status_code)
except Exception as e:
    print("Heartbeat failed:", e)

print("Getting pendentes...")
try:
    r = requests.get(f"{API}/api/impressoes/pendentes", timeout=10)
    print("Pendentes status:", r.status_code)
    print("Pendentes json:", r.json())
except Exception as e:
    print("Pendentes failed:", e)
