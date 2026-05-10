import asyncio
import json
import logging
import math
import websockets
from ksp_client import KspClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ksp-server")

ksp = KspClient()
connected_once = False

import time

def sanitize_for_json(obj):
    """Replaces Infinity, -Infinity, and NaN with JSON-compliant values."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, float):
        if math.isinf(obj) or math.isnan(obj):
            return None # JSON doesn't support Inf/NaN
        return obj
    return obj

async def send_loop(ws):
    global connected_once
    logger.info("Starting telemetry send loop")
    while True:
        try:
            # Get data from KSP
            data = ksp.get_data()
            
            # Add a timestamp to detect stale data in frontend
            data["server_time"] = time.time()

            if not connected_once and data.get("connected"):
                connected_once = True
                logger.info("First successful data broadcast to client")
            
            # Robust JSON conversion handling NaN/Infinity
            try:
                # Use a custom encoder or simple replacement to make it JSON compliant
                # Standard json.dumps with allow_nan=False would raise an error, 
                # but we want to just replace them.
                payload = json.dumps(data, allow_nan=False)
            except ValueError:
                # If it failed due to NaN/Inf, sanitize it manually
                sanitized = sanitize_for_json(data)
                payload = json.dumps(sanitized)
            except Exception as e:
                logger.error(f"JSON serialization error: {e}")
                payload = json.dumps({"connected": ksp.connected, "error": "Serialization error", "server_time": time.time()})

            await ws.send(payload)
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed during send")
            break
        except Exception as ex:
            logger.warning(f"Unexpected error in send_loop: {ex}")
            # Don't break, try to recover in next tick
        await asyncio.sleep(0.2)

async def handle_cmd(ws, raw: str):
    try:
        msg = json.loads(raw)
        cmd = msg.get("type", "")

        if cmd == "set_target":
            target_name = msg.get("target")
            ksp.set_target(target_name)
            logger.info(f"Target set to: {target_name}")
        elif cmd == "add_node":
            ksp.add_node(msg.get("prograde", 0), msg.get("normal", 0), msg.get("radial", 0))
        elif cmd == "add_node_pe":
            ksp.add_node_at_pe(msg.get("prograde", 0), msg.get("normal", 0), msg.get("radial", 0))
        elif cmd == "add_node_ap":
            ksp.add_node_at_ap(msg.get("prograde", 0), msg.get("normal", 0), msg.get("radial", 0))
        elif cmd == "circularize":
            ksp.circularize()
        elif cmd == "remove_node":
            ksp.remove_node()
        elif cmd == "set_maneuver":
            ksp.set_maneuver(msg.get("prograde"), msg.get("normal"), msg.get("radial"))
        elif cmd == "set_node_time":
            orbit = ksp.vessel.orbit if ksp.vessel else None
            if orbit:
                ksp.set_node_time(orbit.epoch + float(msg.get("time", 0)))
        elif cmd == "get_body_names":
            names = ksp.get_body_names()
            await ws.send(json.dumps({"type": "body_names", "names": names}))
    except Exception as ex:
        logger.warning(f"Cmd error: {ex}")
        # If a command fails, verify connection health
        if not ksp.connected:
            logger.info("Command failed due to connection loss, triggering reconnect")

async def handler(ws):
    global connected_once
    logger.info("Client connected")
    try:
        # Try connect if not already
        if not ksp.connected:
            if ksp.connect():
                connected_once = True
                logger.info("Connected to kRPC")
            else:
                logger.info("kRPC not available, will retry")

        async def send_task():
            await send_loop(ws)

        async def recv_task():
            async for raw in ws:
                await handle_cmd(ws, raw)

        await asyncio.gather(send_task(), recv_task())
    except Exception as ex:
        logger.warning(f"Handler error: {ex}")
    finally:
        logger.info("Client disconnected")

async def try_connect_loop():
    while True:
        if not ksp.connected:
            try:
                if ksp.connect():
                    logger.info("Reconnected to kRPC")
                else:
                    logger.info("kRPC not available yet...")
            except Exception as ex:
                logger.warning(f"Connect error: {ex}")
        await asyncio.sleep(2)

async def main():
    port = 8765
    # Listen on 0.0.0.0 to allow connections from any interface (useful for some WSL/Docker/Network setups)
    # and to ensure both 127.0.0.1 and localhost work.
    logger.info(f"Starting WebSocket server on ws://0.0.0.0:{port}")

    asyncio.create_task(try_connect_loop())

    try:
        async with websockets.serve(handler, "0.0.0.0", port):
            await asyncio.Future()
    except Exception as e:
        logger.error(f"Failed to start server: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
