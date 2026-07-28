import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib

# Load data
df = pd.read_csv("traffic_data.csv")

# Separate features from label (label is NOT used for training)
feature_columns = [
    "request_count",
    "avg_time_between_requests_sec",
    "session_duration_sec",
    "failed_login_attempts",
    "user_agent_valid",
    "unique_pages_visited"
]
X = df[feature_columns]
true_labels = df["label"]

# Train Isolation Forest
# contamination = expected proportion of anomalies (~150/950 = 0.158)
model = IsolationForest(n_estimators=100, contamination=0.158, random_state=42)
model.fit(X)

# Get predictions: -1 = anomaly (bot-like), 1 = normal
predictions = model.predict(X)
# Convert to match our label format: 1 = bot, 0 = normal
predicted_labels = [1 if p == -1 else 0 for p in predictions]

# Compare against true labels
df["predicted_label"] = predicted_labels

correct = (df["predicted_label"] == df["label"]).sum()
total = len(df)
accuracy = correct / total * 100

true_positives = ((df["label"] == 1) & (df["predicted_label"] == 1)).sum()
false_negatives = ((df["label"] == 1) & (df["predicted_label"] == 0)).sum()
false_positives = ((df["label"] == 0) & (df["predicted_label"] == 1)).sum()
true_negatives = ((df["label"] == 0) & (df["predicted_label"] == 0)).sum()

print(f"Overall Accuracy: {accuracy:.2f}%")
print()
print(f"Bot sessions correctly flagged (True Positives): {true_positives} / {df['label'].sum()}")
print(f"Bot sessions missed (False Negatives): {false_negatives}")
print(f"Normal sessions incorrectly flagged (False Positives): {false_positives}")
print(f"Normal sessions correctly identified (True Negatives): {true_negatives}")

# Save the trained model
joblib.dump(model, "bot_detection_model.pkl")
print()
print("Model saved to bot_detection_model.pkl")
