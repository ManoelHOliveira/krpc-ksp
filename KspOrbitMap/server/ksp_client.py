import math
import krpc
import time
from typing import Optional, Any

class KspClient:
    def __init__(self):
        self.conn: Optional[krpc.Client] = None
        self.sc: Any = None
        self.vessel: Any = None
        self.flight: Any = None
        self.flight_surface: Any = None
        self.maneuver_nodes: list[Any] = []
        self.target_body: Any = None
        self._bodies_cache: Optional[dict] = None
        self._body_names: list[str] = []

    def connect(self) -> bool:
        try:
            self.conn = krpc.connect(name="KspOrbitMap", address="127.0.0.1", rpc_port=50000, stream_port=50001)
            self.sc = self.conn.space_center
            self._update_vessel()
            self._bodies_cache = self.sc.bodies
            self._body_names = sorted(self._bodies_cache.keys())
            return True
        except Exception:
            self.conn = None
            return False

    def _update_vessel(self):
        if not self.conn: return
        try:
            current_vessel = self.sc.active_vessel
            if not self.vessel or self.vessel.id != current_vessel.id:
                self.vessel = current_vessel
                self.flight = self.vessel.flight(self.vessel.orbit.body.reference_frame)
                self.flight_surface = self.vessel.flight(self.vessel.surface_reference_frame)
                self.maneuver_nodes = []
        except:
            pass

    def disconnect(self):
        if self.conn:
            try: self.conn.close()
            except: pass
        self.conn = None; self.sc = None; self.vessel = None
        self.flight = None; self.flight_surface = None
        self.target_body = None; self._bodies_cache = None
        self.maneuver_nodes = []

    @property
    def connected(self) -> bool:
        if self.conn is None: return False
        try:
            _ = self.conn.krpc.get_status()
            return True
        except:
            self.conn = None
            return False

    def set_target(self, name: Optional[str]):
        if not self.conn: return
        if name and name in self._bodies_cache:
            self.sc.target_body = self._bodies_cache[name]
            self.target_body = self._bodies_cache[name]
        else:
            self.sc.target_body = None
            self.target_body = None

    def get_body_names(self) -> list[str]:
        return self._body_names

    def get_data(self) -> dict:
        if not self.connected:
            return {"connected": False}

        try:
            self._update_vessel()
            if not self.vessel:
                return {"connected": True, "vessel_name": "No Active Vessel"}

            orbit = self.vessel.orbit
            
            # Root-level encounter info for visuals
            encounter_info = None
            try:
                nodes = self.vessel.control.nodes
                check_orbit = nodes[-1].orbit if nodes else self.vessel.orbit
                if check_orbit:
                    time_to_soi = check_orbit.time_to_soi_change
                    if time_to_soi > 0 and not math.isinf(time_to_soi):
                        next_orb = check_orbit.next_orbit
                        if next_orb and next_orb.body:
                            trans_ut = self.sc.ut + time_to_soi
                            # Get the exact position of the target body at intercept time
                            # relative to the body we are currently orbiting.
                            pos = next_orb.body.position(check_orbit.body.reference_frame) # Current
                            # But we want future position
                            try:
                                # We'll approximate future position using orbital math 
                                # as kRPC position_at_ut can be slow or limited.
                                # Or better: just pass the body's orbit and let the frontend 
                                # use the same solver for everything.
                                pass
                            except: pass

                            encounter_info = {
                                "body_name": next_orb.body.name,
                                "periapsis_altitude": next_orb.periapsis_altitude,
                                "transition_ut": trans_ut,
                            }
            except: pass

            result = {
                "connected": True,
                "vessel_name": self.vessel.name,
                "ut": self.sc.ut,
                "vessel": {
                    "altitude": self.flight.mean_altitude if self.flight else 0,
                    "speed": self.flight_surface.speed if self.flight_surface else 0,
                    "mass": self.vessel.mass,
                    "available_thrust": self.vessel.available_thrust,
                    "specific_impulse": self.vessel.specific_impulse,
                },
                "orbit": self._serialize_orbit(orbit),
                "target": self._get_target_data(),
                "maneuvers": self._get_maneuvers_data(),
                "encounter": encounter_info,
                "soi_bodies": self._compute_soi_bodies(),
                "server_time": time.time(),
            }
            return result
        except Exception as ex:
            self.conn = None
            return {"connected": False, "error": str(ex)}

    def _get_encounter_data(self) -> Optional[dict]:
        if not self.connected: return None
        try:
            nodes = self.vessel.control.nodes
            orbit = nodes[-1].orbit if nodes else self.vessel.orbit
            if not orbit: return None

            next_orb = orbit.next_orbit
            if next_orb and next_orb.body:
                return {
                    "body_name": next_orb.body.name,
                    "periapsis_altitude": next_orb.periapsis_altitude,
                    "time_to_pe": next_orb.time_to_periapsis
                }
        except:
            pass
        return None

    def _get_target_data(self) -> Optional[dict]:
        if not self.target_body: return None
        try:
            to = self.sc.target_body.orbit
            if to is None: return None
            return {
                "name": self.target_body.name,
                "orbit": self._serialize_orbit(to)
            }
        except:
            return None

    def _get_maneuvers_data(self) -> list[dict]:
        try:
            nodes = list(self.vessel.control.nodes)
            self.maneuver_nodes = nodes
            
            data_list = []
            for i, node in enumerate(nodes):
                try:
                    po = node.orbit
                    post = None
                    if po:
                        post = self._serialize_orbit(po)
                        try:
                            time_to_soi = po.time_to_soi_change
                            if time_to_soi > 0 and not math.isinf(time_to_soi):
                                no = po.next_orbit
                                if no:
                                    post["next_orbit"] = self._serialize_orbit(no)
                                    post["transition_ut"] = self.sc.ut + time_to_soi
                        except: pass

                    isp = self.vessel.specific_impulse or 300
                    mass = self.vessel.mass
                    av = self.vessel.available_thrust
                    dv = node.delta_v
                    bt = 0
                    if av > 0:
                        md = av / (isp * 9.82)
                        mf = mass * math.exp(-dv / (isp * 9.82))
                        bt = (mass - mf) / md if md > 0 else 0

                    data_list.append({
                        "id": i,
                        "ut": node.ut,
                        "prograde": node.prograde,
                        "normal": node.normal,
                        "radial": node.radial,
                        "delta_v": dv,
                        "burn_time": bt,
                        "post_orbit": post,
                    })
                except: continue # Skip individual node if it fails
            return data_list
        except:
            return []

    def _serialize_orbit(self, orbit, depth=0) -> dict:
        if not orbit or depth > 2: return None
        
        def s(val, default=0):
            try: return val
            except: return default
            
        data = {
            "semi_major_axis": s(orbit.semi_major_axis),
            "eccentricity": s(orbit.eccentricity),
            "argument_of_periapsis": s(orbit.argument_of_periapsis),
            "inclination": s(orbit.inclination),
            "longitude_of_ascending_node": s(orbit.longitude_of_ascending_node),
            "true_anomaly": s(orbit.true_anomaly),
            "mean_anomaly_at_epoch": s(orbit.mean_anomaly_at_epoch),
            "epoch": s(orbit.epoch),
            "periapsis_altitude": s(orbit.periapsis_altitude),
            "apoapsis_altitude": s(orbit.apoapsis_altitude),
            "periapsis": s(orbit.periapsis),
            "apoapsis": s(orbit.apoapsis),
            "body_name": orbit.body.name if s(orbit.body, None) else "Unknown",
            "body_radius": s(orbit.body.equatorial_radius) if s(orbit.body, None) else 600000,
            "mu": orbit.body.gravitational_parameter if s(orbit.body, None) else 3.5316e12,
            "mean_anomaly": s(orbit.mean_anomaly),
        }
        
        try:
            no = orbit.next_orbit
            if no:
                data["next_patch"] = self._serialize_orbit(no, depth + 1)
        except: pass
        
        return data

    def _compute_soi_bodies(self) -> list[dict]:
        if not self.connected: return []
        bodies = []
        try:
            current = self.vessel.orbit.body
            ref = current.reference_frame
            for name, body in self._bodies_cache.items():
                if name == current.name: continue
                try:
                    soi = body.sphere_of_influence
                    if soi <= 0: continue
                    pos = body.position(ref)
                    bx, by, bz = pos[0], pos[1], pos[2]
                    vessel_dist = math.sqrt(bx*bx + by*by + bz*bz)
                    
                    orbit = body.orbit
                    bodies.append({
                        "name": name,
                        "pos_x": bx, "pos_y": by, "pos_z": bz,
                        "soi_radius": soi,
                        "vessel_distance": vessel_dist,
                        "orbit": self._serialize_orbit(orbit) if orbit else None,
                    })
                except: continue
        except: pass
        bodies.sort(key=lambda b: b.get("vessel_distance", float("inf")))
        return bodies

    @staticmethod
    def _fmt_dist(m: float) -> str:
        if m >= 1_000_000: return f"{m/1_000_000:.2f} Mm"
        if m >= 1000: return f"{m/1000:.1f} km"
        return f"{m:.0f} m"

    # --- Maneuver operations ---

    def add_node(self, prograde=0.0, normal=0.0, radial=0.0):
        if not self.connected: return
        orbit = self.vessel.orbit
        nodes = self.vessel.control.nodes
        if nodes:
            ut = nodes[-1].ut + 600
        else:
            ut = self.sc.ut + max(60, orbit.period * 0.25)
        self.vessel.control.add_node(ut, float(prograde), float(normal), float(radial))

    def add_node_at_pe(self, prograde=0.0, normal=0.0, radial=0.0):
        if not self.connected: return
        orbit = self.vessel.orbit
        ut = self.sc.ut + orbit.time_to_periapsis
        # If Pe is behind us (negative time), add a full period
        if orbit.time_to_periapsis < 0:
            ut += orbit.period
        self.vessel.control.add_node(ut, float(prograde), float(normal), float(radial))

    def add_node_at_ap(self, prograde=0.0, normal=0.0, radial=0.0):
        if not self.connected: return
        orbit = self.vessel.orbit
        ut = self.sc.ut + orbit.time_to_apoapsis
        if orbit.time_to_apoapsis < 0:
            ut += orbit.period
        self.vessel.control.add_node(ut, float(prograde), float(normal), float(radial))

    def circularize(self):
        if not self.connected: return
        orbit = self.vessel.orbit
        mu = orbit.body.gravitational_parameter
        a = orbit.semi_major_axis; e = orbit.eccentricity
        r_pe = a * (1 - e)
        circ_v = math.sqrt(mu / r_pe)
        v_pe = math.sqrt(mu * (2 / r_pe - 1 / a))
        dv = circ_v - v_pe
        ut = self.sc.ut + orbit.time_to_periapsis
        if orbit.time_to_periapsis < 0:
            ut += orbit.period
        self.vessel.control.add_node(ut, float(dv), 0, 0)

    def remove_node(self, index=-1):
        if not self.connected: return
        nodes = self.vessel.control.nodes
        if not nodes: return
        try:
            if index == -1: nodes[-1].remove()
            else: nodes[index].remove()
        except: pass

    def set_maneuver(self, index=0, prograde=None, normal=None, radial=None):
        if not self.connected: return
        nodes = self.vessel.control.nodes
        if not nodes or index >= len(nodes): return
        try:
            node = nodes[index]
            if prograde is not None: node.prograde = float(prograde)
            if normal is not None: node.normal = float(normal)
            if radial is not None: node.radial = float(radial)
        except: pass

    def set_node_time(self, index, new_ut: float):
        if not self.connected: return
        nodes = self.vessel.control.nodes
        if not nodes or index >= len(nodes): return
        try:
            node = nodes[index]
            p, n, r = node.prograde, node.normal, node.radial
            node.remove()
            self.vessel.control.add_node(new_ut, float(p), float(n), float(r))
        except: pass
