import requests
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

key = "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"
headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

candidate_models = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
    "llama3-8b-8192",
    "llama3-70b-8192",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "mixtral-8x7b-32768"
]

print("Testing Groq models with user key...")
for m in candidate_models:
    payload = {
        "model": m,
        "messages": [{"role": "user", "content": "Respond with 1 short sentence: system test."}],
        "max_tokens": 40
    }
    try:
        r = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=6)
        if r.status_code == 200:
            res = r.json()["choices"][0]["message"]["content"].strip()
            print(f"[SUCCESS] {m} -> {res}")
        else:
            err = r.json().get("error", {}).get("message", r.text)
            print(f"[FAIL] {m} -> {err[:90]}")
    except Exception as e:
        print(f"[ERR] {m} -> {e}")
