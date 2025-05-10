import serial.tools.list_ports
import time
import sys
import requests
import random
from datetime import datetime

# Feed keys to match Firebase structure
FIREBASE_FEED_IDS = ["anhsang", "doam", "khoangcach", "nhietdo", "quat", "rgb"]
SENSOR_FEEDS = ["anhsang", "doam", "khoangcach", "nhietdo"]
ACTUATOR_FEEDS = ["quat", "rgb"]
FIREBASE_URL = "https://dadn242group82-default-rtdb.asia-southeast1.firebasedatabase.app/"

# Serial port detection
def getPort():
    ports = serial.tools.list_ports.comports()
    for port in ports:
        if "USB-SERIAL" in str(port):
            print(str(port).split(" ")[0])
            return str(port).split(" ")[0]
    return None

# Data processing for serial reading
def processData(data):
    data = data.replace("!", "").replace("#", "")
    splitData = data.split(":")
    if len(splitData) == 2:
        feed_id, value = splitData
        print(f"Nhận từ microcontroller: {feed_id} = {value}")
        if feed_id in FIREBASE_FEED_IDS:
            latest_data[feed_id] = value

# Serial reading
mess = ""
def readSerial():
    global mess
    if ser.inWaiting() > 0:
        mess += ser.read(ser.inWaiting()).decode("UTF-8")
        while "!" in mess and "#" in mess:
            start = mess.find("!")
            end = mess.find("#")
            if start < end:
                processData(mess[start+1:end])
                mess = mess[end+1:]
            else:
                mess = mess[end+1:]

# Send to Firebase (latest value + historical log)
def sendToFirebase(feed_id, value):
    timestamp = int(time.time() * 1000)  # Unix timestamp in milliseconds

    # 1. Send latest value
    latest_url = f"{FIREBASE_URL}/{feed_id}.json"
    # 2. Send to history
    history_url = f"{FIREBASE_URL}/sensor_history/{feed_id}/{timestamp}.json"

    try:
        latest_response = requests.put(latest_url, json=value)
        history_response = requests.put(history_url, json={
            "value": value,
            "timestamp": timestamp
        })

        if latest_response.status_code == 200 and history_response.status_code == 200:
            print(f"[OK] {feed_id}: {value} @ {timestamp}")
        else:
            print(f"[ERR] {feed_id}: {latest_response.text} / {history_response.text}")
    except Exception as e:
        print(f"[ERR] Exception sending {feed_id}: {e}")

# Main program
isMicrobitConnected = False
port = getPort()
if port:
    ser = serial.Serial(port=port, baudrate=115200)
    isMicrobitConnected = True

feed_index = 0
latest_data = {}
previous_values = {}
prev_actuator_values = {"quat": None, "led1": None}

while True:
    if isMicrobitConnected:
        readSerial()

        current_feed = FIREBASE_FEED_IDS[feed_index]

        if current_feed in SENSOR_FEEDS:
            value = latest_data.get(current_feed)
            if value is not None and previous_values.get(current_feed) != value:
                sendToFirebase(current_feed, value)
                previous_values[current_feed] = value

        elif current_feed in ACTUATOR_FEEDS:
            url = f"{FIREBASE_URL}/{current_feed}.json"
            try:
                response = requests.get(url)
                if response.status_code == 200:
                    value = response.json()
                    if prev_actuator_values.get(current_feed) != value:
                        command = f"F:{value}#" if current_feed == "quat" else f"L:{value}#"
                        ser.write(command.encode())
                        print(f"Send command to Yolobit: {command}")
                        prev_actuator_values[current_feed] = value
                else:
                    print(f"ERROR reading {current_feed} from Firebase: {response.text}")
            except Exception as e:
                print(f"ERROR connecting to Firebase for actuator: {e}")

        feed_index = (feed_index + 1) % len(FIREBASE_FEED_IDS)
    else:
        # Simulate data if no device is connected
        for feed_id in SENSOR_FEEDS:
            if feed_id == "anhsang":
                value = str(random.randint(100, 1000))
            elif feed_id == "khoangcach":
                value = str(random.randint(0, 100))
            elif feed_id == "nhietdo":
                value = str(round(random.uniform(20.0, 35.0), 1))
            elif feed_id == "doam":
                value = str(random.randint(30, 90))

            if previous_values.get(feed_id) != value:
                sendToFirebase(feed_id, value)
                previous_values[feed_id] = value