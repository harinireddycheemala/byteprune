ENERGY_INTENSITY_KWH_PER_GB = 0.81
GRID_CARBON_INTENSITY_G_PER_KWH = 442

IMAGE_COMPRESSION_REDUCTION = 0.70
CSS_REMOVAL_REDUCTION = 0.40

MIN_IMPROVEMENT_THRESHOLD = 1

def calculate_co2_and_score(total_bytes, monthly_visitors=10000):
    gb_transferred = total_bytes / 1024 / 1024 / 1024
    kwh_used = gb_transferred * ENERGY_INTENSITY_KWH_PER_GB
    co2_per_visit_g = round(kwh_used * GRID_CARBON_INTENSITY_G_PER_KWH, 4)
    co2_monthly_kg = round((co2_per_visit_g * monthly_visitors) / 1000, 4)

    size_kb = total_bytes / 1024
    performance_score = max(0, min(100, 100 - ((size_kb - 500) / (5000 - 500)) * 100)) if size_kb > 500 else 100
    carbon_score = max(0, min(100, 100 - (co2_per_visit_g / 2) * 100)) if co2_per_visit_g <= 2 else 0
    green_score = round((performance_score * 0.5) + (carbon_score * 0.5))

    return co2_per_visit_g, co2_monthly_kg, green_score

def action_compress_images(resource_breakdown, current_total_bytes):
    image_bytes = resource_breakdown.get("image", {}).get("transferSize", 0)
    if image_bytes == 0:
        return None
    bytes_saved = round(image_bytes * IMAGE_COMPRESSION_REDUCTION)
    new_total_bytes = current_total_bytes - bytes_saved
    return {
        "action": "compress_images",
        "description": f"Convert images to WebP and compress (estimated {IMAGE_COMPRESSION_REDUCTION*100:.0f}% reduction)",
        "bytes_saved": bytes_saved,
        "new_total_bytes": new_total_bytes
    }

def action_remove_unused_css(resource_breakdown, current_total_bytes):
    css_bytes = resource_breakdown.get("stylesheet", {}).get("transferSize", 0)
    if css_bytes == 0:
        return None
    bytes_saved = round(css_bytes * CSS_REMOVAL_REDUCTION)
    new_total_bytes = current_total_bytes - bytes_saved
    return {
        "action": "remove_unused_css",
        "description": f"Remove unused CSS rules (estimated {CSS_REMOVAL_REDUCTION*100:.0f}% reduction)",
        "bytes_saved": bytes_saved,
        "new_total_bytes": new_total_bytes
    }

ALL_ACTIONS = [action_compress_images, action_remove_unused_css]

def plan_next_action(resource_breakdown, current_total_bytes, current_green_score, actions_taken):
    candidates = []
    for action_fn in ALL_ACTIONS:
        if any(a["action"] == action_fn.__name__.replace("action_", "") for a in actions_taken):
            continue
        result = action_fn(resource_breakdown, current_total_bytes)
        if result is None:
            continue
        _, _, new_green_score = calculate_co2_and_score(result["new_total_bytes"])
        improvement = new_green_score - current_green_score
        result["projected_green_score"] = new_green_score
        result["projected_improvement"] = improvement
        candidates.append(result)

    if not candidates:
        return None
    best = max(candidates, key=lambda x: x["projected_improvement"])
    if best["projected_improvement"] < MIN_IMPROVEMENT_THRESHOLD:
        return None
    return best

def run_agentic_loop(resource_breakdown, initial_total_bytes, monthly_visitors=10000, max_iterations=10):
    """
    Runs the full plan -> act -> observe -> re-plan loop.
    Returns a log of every action taken plus the final before/after summary.
    """
    current_total_bytes = initial_total_bytes
    _, initial_co2_monthly, initial_green_score = calculate_co2_and_score(initial_total_bytes, monthly_visitors)

    current_green_score = initial_green_score
    actions_taken = []

    for i in range(max_iterations):
        next_action = plan_next_action(resource_breakdown, current_total_bytes, current_green_score, actions_taken)
        if next_action is None:
            break

        # ACT + OBSERVE
        current_total_bytes = next_action["new_total_bytes"]
        _, new_co2_monthly, new_green_score = calculate_co2_and_score(current_total_bytes, monthly_visitors)

        log_entry = {
            "step": i + 1,
            "action": next_action["action"],
            "description": next_action["description"],
            "bytes_saved": next_action["bytes_saved"],
            "green_score_before": current_green_score,
            "green_score_after": new_green_score
        }
        actions_taken.append(log_entry)
        current_green_score = new_green_score

    _, final_co2_monthly, final_green_score = calculate_co2_and_score(current_total_bytes, monthly_visitors)

    return {
        "before": {
            "total_bytes": initial_total_bytes,
            "co2_monthly_kg": initial_co2_monthly,
            "green_score": initial_green_score
        },
        "after": {
            "total_bytes": current_total_bytes,
            "co2_monthly_kg": final_co2_monthly,
            "green_score": final_green_score
        },
        "co2_saved_monthly_kg": round(initial_co2_monthly - final_co2_monthly, 4),
        "green_score_improvement": final_green_score - initial_green_score,
        "action_log": actions_taken
    }

if __name__ == "__main__":
    test_breakdown = {
        "image": {"transferSize": 3000000},
        "stylesheet": {"transferSize": 200000}
    }
    total = 3500000

    result = run_agentic_loop(test_breakdown, total)

    print("=== BEFORE ===")
    print(result["before"])
    print()
    print("=== AFTER ===")
    print(result["after"])
    print()
    print(f"CO2 saved monthly: {result['co2_saved_monthly_kg']} kg")
    print(f"Green Score improvement: +{result['green_score_improvement']}")
    print()
    print("=== ACTION LOG ===")
    for entry in result["action_log"]:
        print(entry)
