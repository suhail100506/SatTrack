"""
Satellite Visibility System
============================

Given a person's location (lat, lon) and a set of satellite TLEs, this module:

1. Propagates each satellite to "now" (or any given time) using SGP4.
2. Computes the elevation angle of each satellite as seen from the person's
   location. If elevation >= MIN_ELEVATION_DEG, the satellite is "visible"
   (i.e. the person is inside that satellite's visibility footprint).
3. For satellites that are NOT currently visible, finds the closest point
   on the great-circle path toward the satellite's sub-point where the
   elevation angle crosses the visibility threshold -- i.e. the nearest
   spot the person could walk/drive to in order to get a usable signal.

Dependencies: skyfield, numpy
    pip install skyfield numpy --break-system-packages
"""

import math
from dataclasses import dataclass
from typing import List, Optional

import numpy as np
from skyfield.api import EarthSatellite, load, wgs84

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------

EARTH_RADIUS_KM = 6371.0

# Minimum elevation angle (degrees above horizon) needed for a "usable"
# signal. Real receivers usually need 5-10 deg to avoid ground clutter /
# atmospheric attenuation near the horizon. Tune per use case.
MIN_ELEVATION_DEG = 10.0

# Binary-search precision when hunting for the visibility boundary (km)
BOUNDARY_SEARCH_TOLERANCE_KM = 0.1

# How far ahead (hours) to look when predicting the next pass / when the
# current pass will end. 24h covers at least one full pass for any LEO
# satellite (orbital periods are ~90 min - 2h).
PASS_SEARCH_HORIZON_HOURS = 24.0

# Coarse scan step (minutes) used when searching for elevation-threshold
# crossings in time. Crossings are then refined with a binary search.
PASS_SEARCH_STEP_MINUTES = 1.0

# Binary-search precision when refining rise/set times (seconds)
PASS_SEARCH_TOLERANCE_SECONDS = 5.0


# ----------------------------------------------------------------------
# Data model
# ----------------------------------------------------------------------

@dataclass
class SatelliteRecord:
    """Represents a row from your TLE database."""
    name: str
    line1: str
    line2: str


@dataclass
class VisibilityResult:
    satellite: str
    visible: bool
    elevation_deg: float
    azimuth_deg: float
    range_km: float
    sub_point_lat: float
    sub_point_lon: float
    sat_altitude_km: float
    current_time_utc: str
    # Only populated when visible == False
    nearest_point_lat: Optional[float] = None
    nearest_point_lon: Optional[float] = None
    distance_to_nearest_point_km: Optional[float] = None
    # Timing info:
    # - If visible now: when the current pass ends, and how long it lasts
    #   from "now" until it sets.
    # - If not visible now: when the satellite next rises above the
    #   threshold (from the CURRENT location, no movement), and for how
    #   long it will stay visible once it does.
    visible_until_utc: Optional[str] = None
    visible_for_minutes: Optional[float] = None
    next_visible_at_utc: Optional[str] = None
    next_visible_duration_minutes: Optional[float] = None
    # True if no rise/set event was found within PASS_SEARCH_HORIZON_HOURS
    # (e.g. a GEO satellite that is permanently below the horizon here)
    no_pass_in_horizon: bool = False


# ----------------------------------------------------------------------
# Geometry helpers (spherical-Earth, great-circle math)
# ----------------------------------------------------------------------

def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance between two lat/lon points, in km."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def initial_bearing_deg(lat1, lon1, lat2, lon2):
    """Initial bearing (degrees, 0=N, clockwise) from point 1 to point 2."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    y = math.sin(dlambda) * math.cos(phi2)
    x = (math.cos(phi1) * math.sin(phi2)
         - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda))
    theta = math.atan2(y, x)
    return (math.degrees(theta) + 360) % 360


def destination_point(lat, lon, bearing_deg, distance_km):
    """Point reached by travelling `distance_km` along `bearing_deg`
    great-circle bearing, starting from (lat, lon)."""
    delta = distance_km / EARTH_RADIUS_KM
    theta = math.radians(bearing_deg)
    phi1, lambda1 = math.radians(lat), math.radians(lon)

    phi2 = math.asin(math.sin(phi1) * math.cos(delta)
                      + math.cos(phi1) * math.sin(delta) * math.cos(theta))
    lambda2 = lambda1 + math.atan2(
        math.sin(theta) * math.sin(delta) * math.cos(phi1),
        math.cos(delta) - math.sin(phi1) * math.sin(phi2)
    )
    return math.degrees(phi2), (math.degrees(lambda2) + 540) % 360 - 180


# ----------------------------------------------------------------------
# Core engine
# ----------------------------------------------------------------------

class SatelliteVisibilityEngine:
    def __init__(self, satellites: List[SatelliteRecord],
                 min_elevation_deg: float = MIN_ELEVATION_DEG):
        self.ts = load.timescale()
        self.min_elevation_deg = min_elevation_deg
        self.satellites = [
            (rec.name, EarthSatellite(rec.line1, rec.line2, rec.name, self.ts))
            for rec in satellites
        ]

    # -- low level: elevation angle from a ground point to a satellite ----
    def _elevation_deg(self, sat: EarthSatellite, lat, lon, t):
        observer = wgs84.latlon(lat, lon)
        difference = sat - observer
        topocentric = difference.at(t)
        alt, az, distance = topocentric.altaz()
        return alt.degrees, az.degrees, distance.km

    # -- sub-satellite point (ground point directly below satellite) -----
    def _sub_point(self, sat: EarthSatellite, t):
        geocentric = sat.at(t)
        subpoint = wgs84.subpoint(geocentric)
        return subpoint.latitude.degrees, subpoint.longitude.degrees, subpoint.elevation.km

    # -- elevation over a span of time (vectorized) ----------------------
    def _elevation_series(self, sat: EarthSatellite, lat, lon, t0,
                           horizon_hours, step_minutes):
        """Returns (times, elevations_deg) sampled from t0 to
        t0 + horizon_hours, every step_minutes."""
        n_steps = int((horizon_hours * 60.0) / step_minutes) + 1
        offsets_days = np.arange(n_steps) * (step_minutes / 1440.0)
        times = self.ts.tt_jd(t0.tt + offsets_days)

        observer = wgs84.latlon(lat, lon)
        difference = sat - observer
        alt, az, distance = difference.at(times).altaz()
        return times, alt.degrees

    # -- refine a rise/set crossing time with binary search ---------------
    def _refine_crossing(self, sat, lat, lon, t_below, t_above, want_rising):
        """
        Binary-search between t_below and t_above for the moment elevation
        crosses self.min_elevation_deg. `want_rising` indicates whether
        elevation is increasing (rise) or decreasing (set) across this
        interval -- used only to know which side is "below threshold".
        """
        lo, hi = t_below, t_above
        # Ensure lo/hi ordering matches "lo below threshold, hi above" for
        # a rise, or vice versa for a set. We just need elevation(lo) and
        # elevation(hi) to straddle the threshold; the loop below works
        # either way since we re-evaluate each midpoint.
        tol_days = PASS_SEARCH_TOLERANCE_SECONDS / 86400.0

        elev_lo, _, _ = self._elevation_deg(sat, lat, lon, lo)

        while (hi.tt - lo.tt) > tol_days:
            mid = self.ts.tt_jd((lo.tt + hi.tt) / 2.0)
            elev_mid, _, _ = self._elevation_deg(sat, lat, lon, mid)
            crossed = (elev_mid >= self.min_elevation_deg)
            below_at_lo = (elev_lo < self.min_elevation_deg)

            if want_rising:
                if crossed:
                    hi = mid
                else:
                    lo, elev_lo = mid, elev_mid
            else:
                if crossed:
                    lo, elev_lo = mid, elev_mid
                else:
                    hi = mid

        return self.ts.tt_jd((lo.tt + hi.tt) / 2.0)

    # -- find when the current/next pass starts and ends ------------------
    def _find_pass_window(self, sat: EarthSatellite, lat, lon, t0,
                           currently_visible: bool):
        """
        If currently_visible: find when the satellite sets (elevation
        drops below threshold). Returns (None, set_time, no_pass_flag).

        If not currently_visible: find the next rise time and the set
        time that follows it. Returns (rise_time, set_time, no_pass_flag).

        no_pass_flag is True if no relevant crossing was found within
        PASS_SEARCH_HORIZON_HOURS (e.g. permanently visible/invisible GEO
        satellite, from this location).
        """
        times, elevs = self._elevation_series(
            sat, lat, lon, t0, PASS_SEARCH_HORIZON_HOURS, PASS_SEARCH_STEP_MINUTES
        )
        above = elevs >= self.min_elevation_deg

        if currently_visible:
            # find first transition True -> False
            for i in range(1, len(above)):
                if above[i - 1] and not above[i]:
                    set_time = self._refine_crossing(
                        sat, lat, lon, times[i - 1], times[i], want_rising=False
                    )
                    return None, set_time, False
            # never sets within horizon
            return None, None, True
        else:
            # find first transition False -> True (rise)
            rise_idx = None
            for i in range(1, len(above)):
                if not above[i - 1] and above[i]:
                    rise_idx = i
                    rise_time = self._refine_crossing(
                        sat, lat, lon, times[i - 1], times[i], want_rising=True
                    )
                    break
            if rise_idx is None:
                # never rises within horizon
                return None, None, True

            # from rise_idx onward, find the following True -> False (set)
            for j in range(rise_idx + 1, len(above)):
                if above[j - 1] and not above[j]:
                    set_time = self._refine_crossing(
                        sat, lat, lon, times[j - 1], times[j], want_rising=False
                    )
                    return rise_time, set_time, False

            # rises but doesn't set within the remaining horizon
            return rise_time, None, False

    def _find_nearest_visible_point(self, sat: EarthSatellite,
                                     person_lat, person_lon,
                                     sub_lat, sub_lon, t):
        """
        Binary search along the great-circle path from the person's
        location toward the satellite's sub-point for the closest
        location where elevation == min_elevation_deg.
        """
        bearing = initial_bearing_deg(person_lat, person_lon, sub_lat, sub_lon)
        total_dist = haversine_km(person_lat, person_lon, sub_lat, sub_lon)

        lo, hi = 0.0, total_dist
        elev_hi, _, _ = self._elevation_deg(sat, sub_lat, sub_lon, t)

        if elev_hi < self.min_elevation_deg:
            # Even directly under the satellite the elevation is below
            # threshold -- satellite genuinely cannot be seen from
            # anywhere in this hemisphere with this constraint.
            return None, None, None

        # Binary search for the crossing point
        while hi - lo > BOUNDARY_SEARCH_TOLERANCE_KM:
            mid = (lo + hi) / 2
            cand_lat, cand_lon = destination_point(person_lat, person_lon, bearing, mid)
            elev, _, _ = self._elevation_deg(sat, cand_lat, cand_lon, t)
            if elev >= self.min_elevation_deg:
                hi = mid
            else:
                lo = mid

        boundary_lat, boundary_lon = destination_point(person_lat, person_lon, bearing, hi)
        return boundary_lat, boundary_lon, hi

    # -- public API --------------------------------------------------------
    def check(self, person_lat: float, person_lon: float, when=None, limit_heavy: int = 20) -> List[VisibilityResult]:
        """
        Returns a VisibilityResult for every satellite in the database.

        `when`: a skyfield Time object, or None to use "now".
        """
        t = when if when is not None else self.ts.now()
        current_time_str = t.utc_strftime("%Y-%m-%d %H:%M:%S UTC")
        results = []

        # 1. First pass: compute only current position and visibility (fast)
        candidates = []
        for name, sat in self.satellites:
            try:
                elev, az, rng = self._elevation_deg(sat, person_lat, person_lon, t)
                sub_lat, sub_lon, sub_alt = self._sub_point(sat, t)
                visible = elev >= self.min_elevation_deg
                
                candidates.append({
                    "name": name,
                    "sat": sat,
                    "visible": visible,
                    "elev": elev,
                    "az": az,
                    "rng": rng,
                    "sub_lat": sub_lat,
                    "sub_lon": sub_lon,
                    "sub_alt": sub_alt,
                })
            except Exception:
                continue

        # 2. Sort candidates: visible first (highest elevation), then non-visible (closest by haversine distance)
        for c in candidates:
            c["dist_to_sub"] = haversine_km(person_lat, person_lon, c["sub_lat"], c["sub_lon"])
            
        def sort_key(c):
            if c["visible"]:
                return (0, -c["elev"])
            return (1, c["dist_to_sub"])
            
        candidates.sort(key=sort_key)

        # 3. For the top candidates, run the heavy calculations
        visible_count = len([c for c in candidates if c["visible"]])
        heavy_cutoff_index = visible_count + limit_heavy

        for idx, c in enumerate(candidates):
            name = c["name"]
            sat = c["sat"]
            visible = c["visible"]
            elev = c["elev"]
            az = c["az"]
            rng = c["rng"]
            sub_lat = c["sub_lat"]
            sub_lon = c["sub_lon"]
            sub_alt = c["sub_alt"]

            result = VisibilityResult(
                satellite=name,
                visible=visible,
                elevation_deg=elev,
                azimuth_deg=az,
                range_km=rng,
                sub_point_lat=sub_lat,
                sub_point_lon=sub_lon,
                sat_altitude_km=sub_alt,
                current_time_utc=current_time_str,
            )

            # Only do heavy calculation for visible ones or top N closest non-visible ones
            if idx < heavy_cutoff_index:
                if not visible:
                    n_lat, n_lon, dist = self._find_nearest_visible_point(
                        sat, person_lat, person_lon, sub_lat, sub_lon, t
                    )
                    result.nearest_point_lat = n_lat
                    result.nearest_point_lon = n_lon
                    result.distance_to_nearest_point_km = dist

                # -- pass timing (rise/set) at the person's CURRENT location --
                rise_time, set_time, no_pass = self._find_pass_window(
                    sat, person_lat, person_lon, t, currently_visible=visible
                )

                if visible:
                    result.no_pass_in_horizon = no_pass
                    if set_time is not None:
                        result.visible_until_utc = set_time.utc_strftime("%Y-%m-%d %H:%M:%S UTC")
                        result.visible_for_minutes = (set_time.tt - t.tt) * 1440.0
                else:
                    result.no_pass_in_horizon = no_pass
                    if rise_time is not None:
                        result.next_visible_at_utc = rise_time.utc_strftime("%Y-%m-%d %H:%M:%S UTC")
                        if set_time is not None:
                            result.next_visible_duration_minutes = (set_time.tt - rise_time.tt) * 1440.0
            else:
                # Fast defaults for skipped ones
                result.no_pass_in_horizon = False
                if not visible:
                    result.distance_to_nearest_point_km = c["dist_to_sub"]

            results.append(result)

        return results

    def best_satellites(self, person_lat, person_lon, when=None, top_n=None):
        """Return results sorted: visible satellites first (highest
        elevation first), then non-visible ones sorted by how close
        the person currently is to gaining visibility."""
        results = self.check(person_lat, person_lon, when, limit_heavy=20)
        return results[:top_n] if top_n else results


# ----------------------------------------------------------------------
# Analytic visibility-circle radius (optional, for display / map drawing)
# ----------------------------------------------------------------------

def visibility_circle_radius_km(sat_altitude_km: float,
                                 min_elevation_deg: float = MIN_ELEVATION_DEG) -> float:
    """
    Approximate radius (km, great-circle distance) of the footprint within
    which a satellite at `sat_altitude_km` is above `min_elevation_deg`
    elevation, assuming a spherical Earth and the sub-satellite point as
    the circle's center.

    This is a quick approximation for drawing a circle on a map. The
    binary-search method above (which uses real topocentric geometry) is
    more accurate for actual go/no-go decisions.
    """
    Re = EARTH_RADIUS_KM
    r = Re + sat_altitude_km
    eps = math.radians(min_elevation_deg)

    # lambda_max = arccos( (Re/r) * cos(eps) ) - eps
    lambda_max = math.acos((Re / r) * math.cos(eps)) - eps
    return Re * lambda_max
