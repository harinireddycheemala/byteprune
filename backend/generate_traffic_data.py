import random
import csv

def generate_normal_session(session_id):
    request_count = random.randint(5, 50)
    avg_gap = round(random.uniform(2, 30), 2)
    duration = random.randint(30, 600)
    failed_logins = random.choices([0, 1], weights=[95, 5])[0]
    user_agent_valid = random.choices([1, 0], weights=[98, 2])[0]
    unique_pages = random.randint(2, 10)
    return {
        "session_id": session_id,
        "request_count": request_count,
        "avg_time_between_requests_sec": avg_gap,
        "session_duration_sec": duration,
        "failed_login_attempts": failed_logins,
        "user_agent_valid": user_agent_valid,
        "unique_pages_visited": unique_pages,
        "label": 0
    }

def generate_bot_session(session_id):
    request_count = random.randint(200, 2000)
    avg_gap = round(random.uniform(0.01, 0.5), 3)
    duration = random.choice([random.randint(5, 30), random.randint(600, 3600)])
    failed_logins = random.choices([0, random.randint(5, 50)], weights=[30, 70])[0]
    user_agent_valid = random.choices([0, 1], weights=[70, 30])[0]
    unique_pages = random.choices([1, random.randint(50, 200)], weights=[60, 40])[0]
    return {
        "session_id": session_id,
        "request_count": request_count,
        "avg_time_between_requests_sec": avg_gap,
        "session_duration_sec": duration,
        "failed_login_attempts": failed_logins,
        "user_agent_valid": user_agent_valid,
        "unique_pages_visited": unique_pages,
        "label": 1
    }

def main():
    NUM_NORMAL = 800
    NUM_BOT = 150

    sessions = []
    session_id = 1

    for _ in range(NUM_NORMAL):
        sessions.append(generate_normal_session(session_id))
        session_id += 1

    for _ in range(NUM_BOT):
        sessions.append(generate_bot_session(session_id))
        session_id += 1

    random.shuffle(sessions)

    fieldnames = ["session_id", "request_count", "avg_time_between_requests_sec",
                  "session_duration_sec", "failed_login_attempts",
                  "user_agent_valid", "unique_pages_visited", "label"]

    with open("traffic_data.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sessions)

    print(f"Generated {NUM_NORMAL} normal sessions and {NUM_BOT} bot sessions")
    print(f"Total: {len(sessions)} sessions saved to traffic_data.csv")

if __name__ == "__main__":
    main()
