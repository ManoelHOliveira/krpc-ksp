export interface OrbitData {
  semi_major_axis: number;
  eccentricity: number;
  argument_of_periapsis: number;
  inclination: number;
  longitude_of_ascending_node: number;
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
  inclination: number;
  longitude_of_ascending_node: number;
  periapsis_altitude: number;
  apoapsis_altitude: number;
  periapsis: number;
  apoapsis: number;
}

export interface ManeuverData {
  id: number;
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
    inclination: number;
    longitude_of_ascending_node: number;
  };
}

export interface SoiBodyData {
  name: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  soi_radius: number;
  vessel_distance: number;
}

export interface EncounterData {
  body_name: string;
  periapsis_altitude: number;
  time_to_pe: number;
}

export interface ServerData {
  connected: boolean;
  vessel_name?: string;
  vessel?: VesselData | null;
  orbit?: OrbitData | null;
  target?: TargetData | null;
  maneuvers?: ManeuverData[];
  encounter?: EncounterData | null;
  soi_bodies?: SoiBodyData[];
  encounter_text?: string;
  server_time?: number;
  error?: string | null;
}

export interface BodyNamesMsg {
  type: "body_names";
  names: string[];
}

export type WsMessage = ServerData | BodyNamesMsg;
