"""
Demo / smoke test for the satellite visibility engine.

Uses a set of synthetic (non-real) TLEs covering a range of orbit types
so you can see the full range of behaviour:
  - LEO satellites (low/mid/high inclination) that pass overhead briefly
    -> trigger the "nearest point to get visibility" + pass-timing logic.
  - A MEO satellite.
  - GEO satellites at two different longitudes -- one of which may sit
    permanently above or below your horizon depending on your location.
  - A Molniya-like highly elliptical orbit.

Replace SAMPLE_TLES with rows pulled from your own TLE database.
"""

from sattrack.visibility import (
    SatelliteRecord,
    SatelliteVisibilityEngine,
    visibility_circle_radius_km,
    PASS_SEARCH_HORIZON_HOURS,
)
from sattrack.sample_tles import build_sample_satellites

# NOTE: TLEs go stale within days/weeks. In production, refresh these
# regularly (e.g. nightly) from your TLE source and store epoch + lines
# in the database.
#
# For this demo we generate a set of SYNTHETIC (non-real) satellites with
# valid TLE formatting and an epoch of "now", covering a mix of orbit
# types: equatorial LEO, mid-inclination LEO, sun-sync polar LEO (x2),
# MEO, two GEO satellites at different longitudes, and a Molniya-like
# highly elliptical orbit. Swap this out for your real TLE database.
SAMPLE_TLES = build_sample_satellites()


def main():
    engine = SatelliteVisibilityEngine(SAMPLE_TLES, min_elevation_deg=10.0)

    # Example location: Bengaluru, India
    person_lat, person_lon = 13.0827, 77.5877

    results = engine.best_satellites(person_lat, person_lon)

    print(f"Person location: {person_lat}, {person_lon}")
    print(f"Current time:    {results[0].current_time_utc}\n")

    visible_now = [r for r in results if r.visible]
    not_visible = [r for r in results if not r.visible]

    print(f"=== Currently visible ({len(visible_now)}) ===\n")
    for r in visible_now:
        print(f"Satellite: {r.satellite}")
        print(f"  Elevation:        {r.elevation_deg:.2f} deg")
        print(f"  Azimuth:          {r.azimuth_deg:.2f} deg")
        print(f"  Range:            {r.range_km:.1f} km")
        if r.no_pass_in_horizon:
            print(f"  Visible for:      > {PASS_SEARCH_HORIZON_HOURS:.0f} hours "
                  f"(no set time found in search window -- likely GEO)")
        elif r.visible_until_utc:
            print(f"  Visible until:    {r.visible_until_utc}")
            print(f"  Visible for:      {r.visible_for_minutes:.1f} minutes")
        print()

    print(f"=== Not currently visible ({len(not_visible)}) ===\n")
    for r in not_visible:
        print(f"Satellite: {r.satellite}")
        print(f"  Elevation:        {r.elevation_deg:.2f} deg")
        print(f"  Sub-point:        ({r.sub_point_lat:.3f}, {r.sub_point_lon:.3f})")
        print(f"  Sat altitude:     {r.sat_altitude_km:.1f} km")

        if r.nearest_point_lat is not None:
            print(f"  -> Move toward:   ({r.nearest_point_lat:.4f}, {r.nearest_point_lon:.4f})")
            print(f"  -> Distance:      {r.distance_to_nearest_point_km:.1f} km")
        else:
            print("  -> No point on this path would gain visibility right now.")

        if r.no_pass_in_horizon:
            print(f"  Next visible:     not within next {PASS_SEARCH_HORIZON_HOURS:.0f} hours "
                  f"(from current location, without moving)")
        elif r.next_visible_at_utc:
            print(f"  Next visible at:  {r.next_visible_at_utc}")
            if r.next_visible_duration_minutes:
                print(f"  Will stay up for: {r.next_visible_duration_minutes:.1f} minutes")
        print()


if __name__ == "__main__":
    main()

