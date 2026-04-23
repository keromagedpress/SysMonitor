import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath('d:\\Project OS+GRAPHICS\\sysmon\\backend'))

from collector import MetricsCollector

def test_collector():
    c = MetricsCollector()
    try:
        snap = c.collect()
        print("Success!")
        print(snap.model_dump())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_collector()
