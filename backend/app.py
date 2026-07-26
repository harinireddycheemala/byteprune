from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
import os
import requests
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )

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

@app.route('/api/analyze')
def analyze():
    url = request.args.get('url')
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    api_key = os.getenv("PAGESPEED_API_KEY")
    psi_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={url}&key={api_key}"

    response = requests.get(psi_url)
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

    return jsonify({
        "url": url,
        "total_page_size_bytes": total_bytes,
        "load_time_ms": speed_index,
        "num_requests": num_requests,
        "resource_breakdown": resources
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001)
