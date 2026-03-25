#!/usr/bin/env python3
"""Initialize Qdrant collections for the MAS AI system."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.qdrant_client import qdrant_manager


def main():
    print("=== MAS AI System: Qdrant Collection Initialization ===")

    if not qdrant_manager.health_check():
        print("ERROR: Qdrant is not available. Check connection settings.")
        sys.exit(1)

    print("Qdrant is healthy. Initializing collections...")
    qdrant_manager.init_collections()

    print("\nCollection status:")
    for name in ["tmc_catalog", "suppliers", "legal_standards", "legal_precedents", "travel_templates"]:
        try:
            info = qdrant_manager.get_collection_info(name)
            print(f"  {name}: {info['points_count']} points, status={info['status']}")
        except Exception as e:
            print(f"  {name}: ERROR - {e}")

    print("\nDone!")


if __name__ == "__main__":
    main()
