#!/usr/bin/env python3
"""
Pulls the synthetic IT support tickets dataset from Kaggle using kagglehub
and saves it into server/data/synthetic_it_support_tickets.csv.
"""
import os
import sys
import shutil
import kagglehub
from kagglehub import KaggleDatasetAdapter

DATASET_NAME = "ahsanneural/synthetic-it-support-tickets"
CSV_FILENAME = "synthetic_it_support_tickets.csv"

# Destination path: server/data/synthetic_it_support_tickets.csv
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
DEST_DIR = os.path.join(PROJECT_ROOT, "server", "data")
DEST_PATH = os.path.join(DEST_DIR, CSV_FILENAME)

def main():
    print(f"--> Fetching dataset '{DATASET_NAME}' from Kaggle via kagglehub...")
    
    # Download dataset directory from Kaggle
    dataset_dir = kagglehub.dataset_download(DATASET_NAME)
    source_csv = os.path.join(dataset_dir, CSV_FILENAME)
    
    if not os.path.exists(source_csv):
        # Look for any .csv file if name differs
        csv_files = [f for f in os.listdir(dataset_dir) if f.endswith(".csv")]
        if csv_files:
            source_csv = os.path.join(dataset_dir, csv_files[0])
        else:
            raise FileNotFoundError(f"No CSV file found in downloaded dataset directory: {dataset_dir}")

    os.makedirs(DEST_DIR, exist_ok=True)
    shutil.copy2(source_csv, DEST_PATH)
    print(f"--> Saved dataset to: {DEST_PATH}")

    # Load dataset using KaggleDatasetAdapter as specified
    print("--> Loading dataset into Pandas using KaggleDatasetAdapter...")
    try:
        # kagglehub dataset_load/load_dataset
        load_fn = getattr(kagglehub, "dataset_load", getattr(kagglehub, "load_dataset", None))
        df = load_fn(
            KaggleDatasetAdapter.PANDAS,
            DATASET_NAME,
            CSV_FILENAME,
        )
    except Exception as e:
        import pandas as pd
        print(f"--> Note: Falling back to direct pandas read ({e})")
        df = pd.read_csv(DEST_PATH)

    print(f"--> Successfully loaded {len(df):,} records with {len(df.columns)} columns:")
    print("    Columns:", list(df.columns))
    print("\nFirst 5 records:")
    print(df.head())

if __name__ == "__main__":
    main()
