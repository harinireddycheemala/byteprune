from flask import Flask, jsonify
from flask_cors import CORS
import mysql.connector
import os
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

if __name__ == '__main__':
    app.run(debug=True, port=5001)
