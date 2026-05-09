export interface OrbitData {
  semi_major_axis: number;
  eccentricity: number;
  argument_of_periapsis: number;
  true_anomaly: number;
  epoch: number;
  period: number;
  periapsis_altitude: number;
  apoapsis_altitude: number;
  periapsis: number;
  apoapsis: number;
  body_name: string;
  body_radius: number;
  mu: number;
}

export interface VesselData {
  altitude: number;
  speed: number;
  mass: number;
  available_thrust: number;
  specific_impulse: number;
}

export interface PostOrbitData {
  semi_major_axis: number;
  eccentricity: number;
  argument_of_periapsis: number;
  periapsis_altitude: number;
  apoapsis_altitude: number;
  periapsis: number;
  apoapsis: number;
}

export interface ManeuverData {
  ut: number;
  prograde: number;
  normal: number;
  radial: number;
  delta_v: number;
  burn_time: number;
  post_orbit: PostOrbitData | null;
}

export interface TargetData {
  name: string;
  orbit: {
    semi_major_axis: number;
    eccentricity: number;
    argument_of_periapsis: number;
  };
}

export interface SoiBodyData {
  name: string;
  pos_x: number;
  pos_y: number;
  soi_radius: number;
  encounter: boolean;
  close_approach: number;
}

export interface ServerData {
  connected: boolean;
  vessel_name?: string;
  vessel?: VesselData | null;
  orbit?: OrbitData | null;
  target?: TargetData | null;
  maneuver?: ManeuverData | null;
  soi_bodies?: SoiBodyData[];
  encounter_text?: string;
  error?: string | null;
}

export interface BodyNamesMsg {
  type: "body_names";
  names: string[];
}

export type WsMessage = ServerData | BodyNamesMsg;
