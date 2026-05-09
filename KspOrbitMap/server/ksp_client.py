import math
import krpc
from typing import Optional, Any

class KspClient:
    def __init__(self):
        self.conn: Optional[krpc.Client] = None
        self.sc: Any = None
        self.vessel: Any = None
        self.flight: Any = None
        self.flight_surface: Any = None
        self.maneuver_node: Any = None
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
                self.maneuver_node = None # Reset tracked node on vessel switch
        except:
            pass

    def disconnect(self):
        if self.maneuver_node:
            try: self.maneuver_node.remove()
            except: pass
            self.maneuver_node = None
        if self.conn:
            try: self.conn.close()
            except: pass
        self.conn = None; self.sc = None; self.vessel = None
        self.flight = None; self.flight_surface = None
        self.target_body = None; self._bodies_cache = None

    @property
    def connected(self) -> bool:
        return self.conn is not None

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
            a = orbit.semi_major_axis
            e = orbit.eccentricity
            w = orbit.argument_of_periapsis
            nu = orbit.true_anomaly
            body = orbit.body

            result = {
                "connected": True,
                "vessel_name": self.vessel.name,
                "vessel": {
                    "altitude": self.flight.mean_altitude if self.flight else 0,
                    "speed": self.flight_surface.speed if self.flight_surface else 0,
                    "mass": self.vessel.mass,
                    "available_thrust": self.vessel.available_thrust,
                    "specific_impulse": self.vessel.specific_impulse,
                },
                "orbit": {
                    "semi_major_axis": a,
                    "eccentricity": e,
                    "argument_of_periapsis": w,
                    "inclination": orbit.inclination,
                    "longitude_of_ascending_node": orbit.longitude_of_ascending_node,
                    "true_anomaly": nu,
                    "epoch": orbit.epoch,
                    "period": orbit.period,
                    "periapsis_altitude": orbit.periapsis_altitude,
                    "apoapsis_altitude": orbit.apoapsis_altitude,
                    "periapsis": orbit.periapsis,
                    "apoapsis": orbit.apoapsis,
                    "body_name": body.name,
                    "body_radius": body.equatorial_radius,
                    "mu": body.gravitational_parameter,
                },
                "target": self._get_target_data(),
                "maneuver": self._get_maneuver_data(),
                "soi_bodies": self._compute_soi_bodies(),
                "encounter_text": self._compute_encounter_text(),
            }
            return result
        except Exception as ex:
            import traceback
            traceback.print_exc()
            return {"connected": True, "error": str(ex)}

    def _get_target_data(self) -> Optional[dict]:
        if not self.target_body: return None
        try:
            to = self.sc.target_body.orbit
            if to is None: return None
            return {
                "name": self.target_body.name,
                "orbit": {
                    "semi_major_axis": to.semi_major_axis,
                    "eccentricity": to.eccentricity,
                    "argument_of_periapsis": to.argument_of_periapsis,
                    "inclination": to.inclination,
                    "longitude_of_ascending_node": to.longitude_of_ascending_node,
                }
            }
        except:
            return None

    def _get_maneuver_data(self) -> Optional[dict]:
        try:
            # Sync with existing nodes if none tracked
            if not self.maneuver_node or not self._is_node_valid(self.maneuver_node):
                nodes = self.vessel.control.nodes
                if nodes:
                    self.maneuver_node = nodes[0]
                else:
                    self.maneuver_node = None
                    return None

            po = self.maneuver_node.orbit
            post = None
            if po:
                post = {
                    "semi_major_axis": po.semi_major_axis,
                    "eccentricity": po.eccentricity,
                    "argument_of_periapsis": po.argument_of_periapsis,
                    "inclination": po.inclination,
                    "longitude_of_ascending_node": po.longitude_of_ascending_node,
                    "periapsis_altitude": po.periapsis_altitude,
                    "apoapsis_altitude": po.apoapsis_altitude,
                    "periapsis": po.periapsis,
                    "apoapsis": po.apoapsis,
                }

            isp = 300; mass = 0; av = 0
            try: isp = self.vessel.specific_impulse; mass = self.vessel.mass
            except: pass
            try: av = self.vessel.available_thrust
            except: pass

            dv = self.maneuver_node.delta_v
            bt = 0
            if av > 0:
                md = av / (isp * 9.82)
                mf = mass * math.exp(-dv / (isp * 9.82))
                bt = (mass - mf) / md if md > 0 else 0

            return {
                "ut": self.maneuver_node.ut,
                "prograde": self.maneuver_node.prograde,
                "normal": self.maneuver_node.normal,
                "radial": self.maneuver_node.radial,
                "delta_v": dv,
                "burn_time": bt,
                "post_orbit": post,
            }
        except:
            self.maneuver_node = None
            return None

    def _is_node_valid(self, node) -> bool:
        try:
            _ = node.ut
            return True
        except:
            return False


    def _compute_soi_bodies(self) -> list[dict]:
        if not self.connected: return []
        bodies = []
        try:
            current = self.vessel.orbit.body
            check_orbit = self.maneuver_node.orbit if self.maneuver_node else self.vessel.orbit
            mu = current.gravitational_parameter
            ref = current.reference_frame
            n = 96

            for name, body in self._bodies_cache.items():
                if name == current.name: continue
                try:
                    soi = body.sphere_of_influence
                    if soi <= 0: continue
                    if body.orbit is None: continue

                    pos = body.position(ref)
                    bx, by, bz = pos[0], pos[1], pos[2]
                    vessel_dist = math.sqrt(bx*bx + by*by + bz*bz)

                    encounter = False
                    close_dist = float("inf")

                    if check_orbit:
                        ca = check_orbit.semi_major_axis
                        ce = check_orbit.eccentricity
                        cw = check_orbit.argument_of_periapsis
                        ci = check_orbit.inclination
                        clan = check_orbit.longitude_of_ascending_node
                        for i in range(n):
                            th = 2 * math.pi * i / n
                            r = ca * (1 - ce * ce) / (1 + ce * math.cos(th))
                            if r < 0: continue
                            ox = r * math.cos(th)
                            oy = r * math.sin(th)
                            wc, ws = math.cos(cw), math.sin(cw)
                            wx = ox * wc + oy * ws
                            wy = -ox * ws + oy * wc
                            ic, ins = math.cos(ci), math.sin(ci)
                            ix = wx
                            iy = wy * ic
                            iz = wy * ins
                            lc, ls = math.cos(clan), math.sin(clan)
                            px = ix * lc + iy * ls
                            py = -ix * ls + iy * lc
                            pz = iz
                            dx = px - bx
                            dy = py - by
                            dz = pz - bz
                            dist = math.sqrt(dx * dx + dy * dy + dz * dz)
                            close_dist = min(close_dist, dist)
                            if dist < soi: encounter = True

                    bodies.append({
                        "name": name,
                        "pos_x": bx,
                        "pos_y": by,
                        "pos_z": bz,
                        "soi_radius": soi,
                        "encounter": encounter and self.maneuver_node is not None,
                        "close_approach": close_dist,
                        "vessel_distance": vessel_dist,
                    })
                except:
                    continue
        except:
            pass
        bodies.sort(key=lambda b: b.get("vessel_distance", float("inf")))
        return bodies

    def _compute_encounter_text(self) -> str:
        try:
            soi_bodies = self._compute_soi_bodies()
            for sb in soi_bodies:
                if sb.get("encounter"):
                    ca = sb.get("close_approach", 0)
                    return f"→ {sb['name']} (CA: {self._fmt_dist(ca)})"
        except:
            pass
        return ""

    def _compute_encounter_coords(self) -> Optional[tuple[float, float, float]]:
        if not self.connected or not self.maneuver_node: return None
        current = self.vessel.orbit.body
        try:
            for name, body in self._bodies_cache.items():
                if name == current.name: continue
                pos = body.position(current.reference_frame)
                check_orbit = self.maneuver_node.orbit
                if check_orbit is None: continue
                
                soi = body.sphere_of_influence
                ca = check_orbit.semi_major_axis
                ce = check_orbit.eccentricity
                cw = check_orbit.argument_of_periapsis
                ci = check_orbit.inclination
                clan = check_orbit.longitude_of_ascending_node
                
                best_d = float("inf")
                best_pos = (0.0, 0.0, 0.0)
                
                for i in range(128):
                    th = 2 * math.pi * i / 128
                    r = ca * (1 - ce * ce) / (1 + ce * math.cos(th))
                    if r < 0: continue
                    ox = r * math.cos(th); oy = r * math.sin(th)
                    wc, ws = math.cos(cw), math.sin(cw)
                    wx = ox * wc + oy * ws; wy = -ox * ws + oy * wc
                    ic, ins = math.cos(ci), math.sin(ci)
                    ix = wx; iy = wy * ic
                    lc, ls = math.cos(clan), math.sin(clan)
                    px = ix * lc + iy * ls; py = -ix * ls + iy * lc
                    d = math.sqrt((px - pos[0])**2 + (py - pos[1])**2)
                    if d < best_d:
                        best_d = d
                        best_pos = (px, py, 0.0)
                if best_d < soi:
                    return best_pos
        except: pass
        return None

    def _closest_approach(self, orbit, target_pos):
        ca = orbit.semi_major_axis; ce = orbit.eccentricity; cw = orbit.argument_of_periapsis
        ci = orbit.inclination; clan = orbit.longitude_of_ascending_node
        best = float("inf")
        for i in range(128):
            th = 2 * math.pi * i / 128
            r = ca * (1 - ce * ce) / (1 + ce * math.cos(th))
            if r < 0: continue
            ox = r * math.cos(th); oy = r * math.sin(th)
            wc, ws = math.cos(cw), math.sin(cw)
            wx = ox * wc + oy * ws; wy = -ox * ws + oy * wc
            ic, ins = math.cos(ci), math.sin(ci)
            ix = wx; iy = wy * ic
            lc, ls = math.cos(clan), math.sin(clan)
            px = ix * lc + iy * ls; py = -ix * ls + iy * lc
            d = math.sqrt((px - target_pos[0])**2 + (py - target_pos[1])**2)
            best = min(best, d)
        return best

    @staticmethod
    def _fmt_dist(m: float) -> str:
        if m >= 1_000_000: return f"{m/1_000_000:.2f} Mm"
        if m >= 1000: return f"{m/1000:.1f} km"
        return f"{m:.0f} m"

    # --- Maneuver operations ---

    def add_node(self, prograde=0.0, normal=0.0, radial=0.0):
        if not self.connected: return
        self.remove_node()
        orbit = self.vessel.orbit
        ut = orbit.epoch + max(60, orbit.period * 0.25)
        self.maneuver_node = self.vessel.control.add_node(ut, float(prograde), float(normal), float(radial))

    def add_node_at_pe(self, prograde=0.0, normal=0.0, radial=0.0):
        if not self.connected: return
        self.remove_node()
        orbit = self.vessel.orbit
        ut = orbit.epoch + orbit.time_to_periapsis
        if ut <= orbit.epoch: ut = orbit.epoch + 60
        self.maneuver_node = self.vessel.control.add_node(ut, float(prograde), float(normal), float(radial))

    def add_node_at_ap(self, prograde=0.0, normal=0.0, radial=0.0):
        if not self.connected: return
        self.remove_node()
        orbit = self.vessel.orbit
        ut = orbit.epoch + orbit.time_to_apoapsis
        if ut <= orbit.epoch: ut = orbit.epoch + 60
        self.maneuver_node = self.vessel.control.add_node(ut, float(prograde), float(normal), float(radial))

    def circularize(self):
        if not self.connected: return
        self.remove_node()
        orbit = self.vessel.orbit
        mu = orbit.body.gravitational_parameter
        a = orbit.semi_major_axis; e = orbit.eccentricity
        r_pe = a * (1 - e)
        circ_v = math.sqrt(mu / r_pe)
        v_pe = math.sqrt(mu * (2 / r_pe - 1 / a))
        dv = circ_v - v_pe
        ut = orbit.epoch + orbit.time_to_periapsis
        if ut <= orbit.epoch: ut = orbit.epoch + 60
        self.maneuver_node = self.vessel.control.add_node(ut, float(dv), 0, 0)

    def remove_node(self):
        if not self.maneuver_node: return
        try: self.maneuver_node.remove()
        except: pass
        self.maneuver_node = None

    def set_maneuver(self, prograde=None, normal=None, radial=None):
        if not self.maneuver_node: return
        try:
            if prograde is not None: self.maneuver_node.prograde = float(prograde)
            if normal is not None: self.maneuver_node.normal = float(normal)
            if radial is not None: self.maneuver_node.radial = float(radial)
        except: pass

    def set_node_time(self, new_ut: float):
        if not self.maneuver_node or not self.connected: return
        try:
            orbit = self.vessel.orbit
            if new_ut <= orbit.epoch: new_ut = orbit.epoch + 1
            p = self.maneuver_node.prograde
            n = self.maneuver_node.normal
            r = self.maneuver_node.radial
            self.maneuver_node.remove()
            self.maneuver_node = self.vessel.control.add_node(new_ut, float(p), float(n), float(r))
        except: pass
