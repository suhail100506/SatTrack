export interface SatelliteResult {
  name: string;
  visible: boolean;
  elevation_deg: number;
  azimuth_deg: number | null;
  range_km: number | null;
  sub_point_lat: number | null;
  sub_point_lon: number | null;
  sat_altitude_km: number | null;
  visible_until_utc: string | null;
  visible_for_minutes: number | null;
  next_visible_at_utc: string | null;
  next_visible_duration_minutes: number | null;
  nearest_point_lat: number | null;
  nearest_point_lon: number | null;
  distance_to_nearest_point_km: number | null;
  no_pass_in_horizon: boolean;
  current_time_utc: string;
  tle_line1?: string | null;
  tle_line2?: string | null;
}
