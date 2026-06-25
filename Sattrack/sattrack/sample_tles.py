"""
Synthetic TLE generator.

Produces *valid-format* TLEs (correct field widths, checksums, and epoch
set to "now") for a variety of orbit types -- without needing real
satellite data. Useful for demos/tests of the visibility engine where you
want a realistic mix of LEO/MEO/GEO/elliptical orbits.

These do NOT correspond to real objects; satellite numbers are in the
unused 9xxxx range and names are descriptive.
"""

import math
from datetime import datetime, timezone

from skyfield.api import load
from .visibility import SatelliteRecord

GM_EARTH = 398600.4418  # km^3 / s^2
EARTH_RADIUS_KM = 6371.0


def _checksum(line_69_chars: str) -> int:
    """TLE checksum: sum of digits (mod 10); '-' counts as 1, all other
    non-digit characters count as 0. Operates on the first 68 chars."""
    total = 0
    for ch in line_69_chars[:68]:
        if ch.isdigit():
            total += int(ch)
        elif ch == "-":
            total += 1
    return total % 10


def _epoch_fields(dt: datetime):
    """Return (epoch_year_2digit, day_of_year_with_fraction)."""
    year2 = dt.year % 100
    start_of_year = datetime(dt.year, 1, 1, tzinfo=timezone.utc)
    delta = dt - start_of_year
    day_of_year_frac = 1.0 + delta.total_seconds() / 86400.0
    return year2, day_of_year_frac


def _mean_motion_rev_per_day(semi_major_axis_km: float) -> float:
    """Kepler's third law -> mean motion in revolutions/day."""
    n_rad_s = math.sqrt(GM_EARTH / semi_major_axis_km ** 3)
    return n_rad_s * 86400.0 / (2 * math.pi)


def _format_exp(value: float) -> str:
    """Format a small number in TLE's '+NNNNN-N' style (assumed decimal
    point, signed single-digit exponent). Used for BSTAR / 2nd derivative
    of mean motion. value=0 -> ' 00000-0' (8 chars with sign)."""
    if value == 0:
        return " 00000-0"
    sign = "-" if value < 0 else " "
    value = abs(value)
    exponent = math.floor(math.log10(value)) + 1
    mantissa = value / (10 ** exponent)
    mantissa_digits = round(mantissa * 1e5)
    if mantissa_digits >= 100000:
        mantissa_digits //= 10
        exponent += 1
    return f"{sign}{mantissa_digits:05d}-{abs(exponent)}" if exponent <= 0 else \
           f"{sign}{mantissa_digits:05d}+{exponent}"


def make_tle(
    name: str,
    sat_num: int,
    inclination_deg: float,
    raan_deg: float,
    eccentricity: float,
    arg_perigee_deg: float,
    mean_anomaly_deg: float,
    semi_major_axis_km: float,
    epoch_dt: datetime = None,
    bstar: float = 0.0001,
) -> SatelliteRecord:
    """Build a syntactically valid TLE pair for a synthetic satellite."""
    if epoch_dt is None:
        epoch_dt = datetime.now(timezone.utc)

    epoch_year2, epoch_day = _epoch_fields(epoch_dt)
    mean_motion = _mean_motion_rev_per_day(semi_major_axis_km)
    ecc_str = f"{eccentricity:.7f}".split(".")[1]  # 7 digits, no leading "0."

    # ---- Line 1 ----
    line1_body = (
        f"1 {sat_num:05d}U 26001A   "
        f"{epoch_year2:02d}{epoch_day:012.8f} "
        f" .00000000  00000-0 "
        f"{_format_exp(bstar)} 0  001"
    )
    line1 = line1_body + str(_checksum(line1_body + "0"))

    # ---- Line 2 ----
    line2_body = (
        f"2 {sat_num:05d} "
        f"{inclination_deg:8.4f} "
        f"{raan_deg:8.4f} "
        f"{ecc_str} "
        f"{arg_perigee_deg:8.4f} "
        f"{mean_anomaly_deg:8.4f} "
        f"{mean_motion:11.8f}00001"
    )
    line2 = line2_body + str(_checksum(line2_body + "0"))

    return SatelliteRecord(name=name, line1=line1, line2=line2)


# ----------------------------------------------------------------------
# A varied sample "database" of synthetic satellites
# ----------------------------------------------------------------------

def build_sample_satellites(epoch_dt: datetime = None):
    """Returns a list of SatelliteRecord covering different orbit classes."""
    Re = EARTH_RADIUS_KM
    sats = [
        # LEO, low inclination -- equatorial belt
        make_tle(
            "LEO-EQUATORIAL-500", 90001,
            inclination_deg=5.0, raan_deg=40.0, eccentricity=0.0006,
            arg_perigee_deg=60.0, mean_anomaly_deg=120.0,
            semi_major_axis_km=Re + 500, epoch_dt=epoch_dt,
        ),
        # LEO, mid-inclination -- typical communications constellation
        make_tle(
            "LEO-MIDINC-550", 90002,
            inclination_deg=53.0, raan_deg=200.0, eccentricity=0.0002,
            arg_perigee_deg=10.0, mean_anomaly_deg=300.0,
            semi_major_axis_km=Re + 550, epoch_dt=epoch_dt,
        ),
        # LEO, sun-synchronous polar -- earth observation
        make_tle(
            "LEO-POLAR-SUNSYNC-700", 90003,
            inclination_deg=98.2, raan_deg=15.0, eccentricity=0.0012,
            arg_perigee_deg=90.0, mean_anomaly_deg=0.0,
            semi_major_axis_km=Re + 700, epoch_dt=epoch_dt,
        ),
        # LEO, near-polar, different phase -- for a 2nd polar pass
        make_tle(
            "LEO-POLAR-SUNSYNC-700B", 90004,
            inclination_deg=98.2, raan_deg=105.0, eccentricity=0.0012,
            arg_perigee_deg=270.0, mean_anomaly_deg=180.0,
            semi_major_axis_km=Re + 700, epoch_dt=epoch_dt,
        ),
        # MEO -- navigation-constellation-like
        make_tle(
            "MEO-NAV-20200", 90005,
            inclination_deg=55.0, raan_deg=80.0, eccentricity=0.001,
            arg_perigee_deg=0.0, mean_anomaly_deg=45.0,
            semi_major_axis_km=Re + 20200, epoch_dt=epoch_dt,
        ),
        # GEO -- geostationary over the Indian Ocean (~75E)
        make_tle(
            "GEO-75E", 90006,
            inclination_deg=0.05, raan_deg=42.74, eccentricity=0.0001,
            arg_perigee_deg=0.0, mean_anomaly_deg=0.0,
            semi_major_axis_km=42164.0, epoch_dt=epoch_dt,
        ),
        # GEO -- geostationary far away over the Americas (~100W)
        make_tle(
            "GEO-100W", 90007,
            inclination_deg=0.05, raan_deg=227.74, eccentricity=0.0001,
            arg_perigee_deg=0.0, mean_anomaly_deg=0.0,
            semi_major_axis_km=42164.0, epoch_dt=epoch_dt,
        ),
        # Highly elliptical, Molniya-like (12h period, high inclination)
        make_tle(
            "HEO-MOLNIYA-LIKE", 90008,
            inclination_deg=63.4, raan_deg=30.0, eccentricity=0.72,
            arg_perigee_deg=270.0, mean_anomaly_deg=0.0,
            semi_major_axis_km=26554.0, epoch_dt=epoch_dt,
        ),
    ]
    return sats


if __name__ == "__main__":
    # Sanity check: load each TLE in skyfield without errors and print
    # basic propagated info.
    ts = load.timescale()
    for rec in build_sample_satellites():
        from skyfield.api import EarthSatellite, wgs84
        sat = EarthSatellite(rec.line1, rec.line2, rec.name, ts)
        t = ts.now()
        sub = wgs84.subpoint(sat.at(t))
        print(f"{rec.name:24s} alt={sub.elevation.km:9.1f} km  "
              f"lat={sub.latitude.degrees:7.2f}  lon={sub.longitude.degrees:7.2f}")
