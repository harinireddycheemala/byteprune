from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/ping')
def ping():
    return jsonify({"status": "ok", "message": "BytePrune backend is running"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

