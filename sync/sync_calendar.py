#!/usr/bin/env python3
"""
Apple Calendar → Session Tracker sync script.
Run this on your Mac to push completed calendar events to the app.

Setup:
  1. pip3 install requests
  2. Set SYNC_SECRET in your environment (must match .env.local SYNC_SECRET)
  3. Run manually: python3 sync_calendar.py
  4. Or install as a LaunchAgent to run every 15 min (see README)

Requirements: macOS with Calendar.app, Python 3.8+
"""

import sqlite3
import json
import os
import sys
import datetime
import requests

APP_URL = os.environ.get("SESSION_TRACKER_URL", "http://localhost:3000")
SYNC_SECRET = os.environ.get("SYNC_SECRET", "dev-secret")
HOURS_BACK = int(os.environ.get("SYNC_HOURS_BACK", "25"))

# Apple Calendar stores dates as seconds since 2001-01-01 (Apple Epoch)
APPLE_EPOCH_OFFSET = datetime.datetime(2001, 1, 1, tzinfo=datetime.timezone.utc).timestamp()

CALENDAR_DB_PATHS = [
    os.path.expanduser("~/Library/Group Containers/group.com.apple.calendar/Library/Calendars/Calendar Cache"),
    os.path.expanduser("~/Library/Calendars/Calendar Cache"),
]


def find_calendar_db():
    for path in CALENDAR_DB_PATHS:
        if os.path.exists(path):
            return path
    return None


def apple_to_unix(apple_ts):
    return apple_ts + APPLE_EPOCH_OFFSET


def get_recent_events(db_path, hours_back=25):
    now_unix = datetime.datetime.now(datetime.timezone.utc).timestamp()
    now_apple = now_unix - APPLE_EPOCH_OFFSET
    cutoff_apple = now_apple - (hours_back * 3600)

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row

    try:
        rows = conn.execute("""
            SELECT
                ROWID,
                summary,
                startDate,
                endDate,
                status
            FROM CalendarItem
            WHERE startDate >= ?
              AND endDate <= ?
              AND (status IS NULL OR status != 1)
              AND summary IS NOT NULL
              AND summary != ''
            ORDER BY startDate DESC
        """, (cutoff_apple, now_apple)).fetchall()
    except sqlite3.OperationalError as e:
        print(f"Error querying calendar DB: {e}", file=sys.stderr)
        print("Tip: Grant Full Disk Access to Terminal in System Preferences > Privacy.", file=sys.stderr)
        return []
    finally:
        conn.close()

    events = []
    for row in rows:
        events.append({
            "id": f"apple-{row['ROWID']}",
            "title": row["summary"],
            "date": int(apple_to_unix(row["startDate"])),
        })
    return events


def main():
    db_path = find_calendar_db()
    if not db_path:
        print("Could not find Apple Calendar database.", file=sys.stderr)
        sys.exit(1)

    print(f"Found calendar DB: {db_path}")
    events = get_recent_events(db_path, HOURS_BACK)
    print(f"Found {len(events)} events in the past {HOURS_BACK}h")

    if not events:
        print("Nothing to sync.")
        return

    try:
        resp = requests.post(
            f"{APP_URL}/api/calendar/sync",
            json={"events": events},
            headers={"x-sync-secret": SYNC_SECRET},
            timeout=10,
        )
        resp.raise_for_status()
        result = resp.json()
        print(f"Sync complete: scanned={result['scanned']} matched={result['matched']} pending={result['pending']} skipped={result['skipped']}")
    except requests.exceptions.RequestException as e:
        print(f"Failed to reach app at {APP_URL}: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
