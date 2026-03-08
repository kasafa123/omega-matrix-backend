from flask import Flask, jsonify
from flask_cors import CORS
import requests
import time

app = Flask(__name__)
CORS(app)

USER = "kasafaa123@gmail.com"
PASS = "kasafa12345"
URL = "https://opensky-network.org/api/states/all"

cache = {"data": None, "waktu": 0}

@app.route('/flights')
def flights():
    if time.time() - cache["waktu"] < 10 and cache["data"]:
        return jsonify(cache["data"])
    try:
        resp = requests.get(URL, auth=(USER, PASS), timeout=10)
        data = resp.json()
        hasil = []
        for state in data.get("states", []):
            if state[5] and state[6]:
                pesawat = {
                    "callsign": state[1].strip() if state[1] else "N/A",
                    "lat": state[6],
                    "lon": state[5],
                    "alt": state[7],
                    "speed": state[9],
                    "track": state[10],
                    "from": state[2]
                }
                hasil.append(pesawat)
        cache["data"] = hasil
        cache["waktu"] = time.time()
        return jsonify(hasil)
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "gagal ambil data"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)