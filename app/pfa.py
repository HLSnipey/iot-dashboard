import smbus2
from smbus2 import i2c_msg
import struct
import time
import requests

bus = smbus2.SMBus(1)

# --- SUPABASE CONFIG ---
SUPABASE_URL = "https://vyueomawiqowlapdjyvc.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5dWVvbWF3aXFvd2xhcGRqeXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTI4NzQsImV4cCI6MjA5MDk2ODg3NH0.sCYGobvxkYIY956rI5OHgvOKUMDSiKFfwUF8-w8gsrk"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# --- CONFIGURATION SCT013 ---
SCT_OFFSET = 3.80
SCT_GAIN   = 2.1
SCT_TOURS  = 6.0
SCT_VOLT   = 238.0

def read_data():
    p_v, p_i, p_p = 0.0, 0.0, 0.0
    try:
        msg = i2c_msg.read(0x08, 12)
        bus.i2c_rdwr(msg)
        p_v, p_i, p_p = struct.unpack('fff', bytes(list(msg)))
    except:
        pass

    s_i, s_p = 0.0, 0.0
    try:
        msg = i2c_msg.read(0x09, 4)
        bus.i2c_rdwr(msg)
        raw_val = struct.unpack('f', bytes(list(msg)))[0]
        brute = raw_val - SCT_OFFSET
        if brute > 0:
            s_i = (brute / SCT_TOURS) * SCT_GAIN
            s_p = s_i * SCT_VOLT
    except:
        pass

    return (p_v, p_i, p_p), (s_i, s_p)

def push_supabase(pzem, sct):
    try:
        # Push PZEM
        requests.post(
            f"{SUPABASE_URL}/rest/v1/pzem_readings",
            headers=HEADERS,
            json={
                "tension":   round(float(pzem[0]), 2),
                "courant":   round(float(pzem[1]), 3),
                "puissance": round(float(pzem[2]), 2)
            },
            timeout=3
        )
        # Push SCT
        requests.post(
            f"{SUPABASE_URL}/rest/v1/sct_readings",
            headers=HEADERS,
            json={
                "courant":   round(float(sct[0]), 3),
                "puissance": round(float(sct[1]), 2)
            },
            timeout=3
        )
    except Exception as e:
        print(f"[SUPABASE ERROR] {e}")

print("Monitoring en cours... (Ctrl+C pour quitter)")
print("-" * 50)

try:
    while True:
        pzem, sct = read_data()

        print(f"[PZEM] {pzem[0]:5.1f}V | {pzem[1]:5.2f}A | {pzem[2]:5.1f}W")
        print(f"[SCT ] {sct[0]:11.2f}A | {sct[1]:11.1f}W")
        print("-" * 50)

        push_supabase(pzem, sct)

        time.sleep(2)
except KeyboardInterrupt:
    print("\nFin.")
finally:
    bus.close()