import time
from connection import get_connection
from krpc.services.spacecenter import Vessel

def stage(vessel: Vessel):
    vessel.control.activate_next_stage()

def set_throttle_max(vessel: Vessel):
    vessel.control.throttle = 1.

def set_throttle_min(vessel: Vessel):
    vessel.control.throttle = 0.

def countdown(seconds):
    for i in range(seconds, 0, -1):
        time.sleep(1)
        print(i)


def do_launch(vessel: Vessel):
    print(f"Ligando motor por 5 segundos")

    # testa o motor principal do foguete por alguns segundos
    stage(vessel)

    set_throttle_max(vessel)
    countdown(5)
    set_throttle_min(vessel)


def main():
    conn = get_connection("Ascent")
    vessel = conn.space_center.active_vessel

    countdown(3)
    do_launch(vessel)


if __name__ == "__main__":
    main()