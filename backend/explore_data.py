import pandas as pd

df = pd.read_csv("traffic_data.csv")

print("Dataset shape:", df.shape)
print()
print("First 5 rows:")
print(df.head())
print()
print("Summary statistics:")
print(df.describe())
print()
print("Label counts:")
print(df["label"].value_counts())
