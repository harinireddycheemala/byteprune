from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
import os
import requests
import joblib
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

ENERGY_INTENSITY_KWH_PER_GB = 0.81
GRID_CARBON_INTENSITY_G_PER_KWH = 442

# Load the trained bot detection model once at startup
bot_model = joblib.load("bot_detection_model.pkl")

FEATURE_COLUMNS = [
    "request_count",
    "avg_time_between_requests_sec",
    "session_duration_sec",
    "failed_login_attempts",
    "user_agent_valid",
    "unique_pages_visited"
]

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )

def calculate_co2(total_bytes, monthly_visitors=10000):
    gb_transferred = total_bytes / 1024 / 1024 / 1024
    kwh_used = gb_transferred * ENERGY_INTENSITY_KWH_PER_GB
    co2_per_visit_g = kwh_used * GRID_CARBON_INTENSITY_G_PER_KWH
    co2_monthly_kg = (co2_per_visit_g * monthly_visitors) / 1000
    return round(co2_per_visit_g, 4), round(co2_monthly_kg, 4)

def calculate_green_score(total_bytes, co2_per_visit_g):
    size_kb = total_bytes / 1024
    performance_score = max(0, min(100, 100 - ((size_kb - 500) / (5000 - 500)) * 100)) if size_kb > 500 else 100
    carbon_score = max(0, min(100, 100 - (co2_per_visit_g / 2) * 100)) if co2_per_visit_g <= 2 else 0
    green_score = round((performance_score * 0.5) + (carbon_score * 0.5))
    return green_score, round(performance_score), round(carbon_score)

def get_or_create_website(cursor, url):
    cursor.execute("SELECT website_id FROM websites WHERE url = %s", (url,))
    row = cursor.fetchone()
    if row:
        return row[0]
    cursor.execute("INSERT INTO websites (url, owner) VALUES (%s, %s)", (url, "unknown"))
    return cursor.lastrowid

def save_scan(website_id, green_score, carbon_score):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO scan_history (website_id, green_score, carbon_score) VALUES (%s, %s, %s)",
        (website_id, green_score, carbon_score)
    )
    conn.commit()
    cursor.close()
    conn.close()

@app.route('/api/ping')
def ping():
    return jsonify({"status": "ok", "message": "BytePrune backend is running"})

@app.route('/api/db-check')
def db_check():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES;")
    tables = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return jsonify({"status": "ok", "tables": tables})

@app.route('/api/detect-bot', methods=['POST'])
def detect_bot():
    data = request.get_json()

    missing = [col for col in FEATURE_COLUMNS if col not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    session_df = pd.DataFrame([data], columns=FEATURE_COLUMNS)
    prediction = bot_model.predict(session_df)[0]
    anomaly_score = bot_model.decision_function(session_df)[0]

    is_bot = prediction == -1

    return jsonify({
        "is_bot": bool(is_bot),
        "classification": "bot-like" if is_bot else "normal",
        "anomaly_score": round(float(anomaly_score), 4)
    })

@app.route('/api/analyze')
def analyze():
    url = request.args.get('url')
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    api_key = os.getenv("PAGESPEED_API_KEY")
    psi_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={url}&key={api_key}"

    try:
        response = requests.get(psi_url, timeout=60)
    except requests.exceptions.Timeout:
        return jsonify({"error": "PageSpeed analysis timed out. This page may be too large or slow to analyze. Try again or use a lighter page."}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Request failed: {str(e)}"}), 500

    if response.status_code != 200:
        return jsonify({"error": "Failed to fetch PageSpeed data"}), 500

    data = response.json()
    lighthouse = data.get("lighthouseResult", {})
    audits = lighthouse.get("audits", {})

    total_bytes = audits.get("total-byte-weight", {}).get("numericValue", 0)
    speed_index = audits.get("speed-index", {}).get("numericValue", 0)
    num_requests = audits.get("diagnostics", {}).get("details", {}).get("items", [{}])[0].get("numRequests", 0)
    resource_summary = audits.get("resource-summary", {}).get("details", {}).get("items", [])

    resources = {}
    for item in resource_summary:
        resources[item.get("resourceType")] = {
            "transferSize": item.get("transferSize", 0),
            "requestCount": item.get("requestCount", 0)
        }

    co2_per_visit_g, co2_monthly_kg = calculate_co2(total_bytes)
    green_score, performance_score, carbon_score = calculate_green_score(total_bytes, co2_per_visit_g)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        website_id = get_or_create_website(cursor, url)
        conn.commit()
        cursor.close()
        conn.close()
        save_scan(website_id, green_score, carbon_score)
        saved = True
    except Exception as e:
        saved = False
        print(f"DB save error: {e}")

    return jsonify({
        "url": url,
        "total_page_size_bytes": total_bytes,
        "load_time_ms": speed_index,
        "num_requests": num_requests,
        "resource_breakdown": resources,
        "co2_per_visit_g": co2_per_visit_g,
        "co2_monthly_kg": co2_monthly_kg,
        "green_score": green_score,
        "performance_sub_score": performance_score,
        "carbon_sub_score": carbon_score,
        "saved_to_db": saved
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001)
