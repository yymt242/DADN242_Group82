import serial.tools.list_ports
import time
import sys
from Adafruit_IO import MQTTClient

# Define all your feed IDs here
AIO_FEED_IDS = ["anhsang", "doam", "khoangcach", "led1", "nhietdo", "quat"]
AIO_USERNAME = "yymt242"
AIO_KEY = "aio_FdAg28NUZ1PArEY9IjaXGYcz6NRy"

# Callback functions
def connected(client):
    print("Kết nối thành công đến Adafruit IO")
    for feed in AIO_FEED_IDS:
        client.subscribe(feed)

def subscribe(client, userdata, mid, granted_qos):
    print(f"Đăng ký feed thành công")

def disconnected(client):
    print("Ngắt kết nối...")
    sys.exit(1)

def message(client, feed_id, payload):
    print(f"Nhận dữ liệu từ {feed_id}: {payload}")
    if isMicrobitConnected:
        ser.write((f"{feed_id}:{payload}#").encode())

# MQTT setup
client = MQTTClient(AIO_USERNAME, AIO_KEY)
client.on_connect = connected
client.on_disconnect = disconnected
client.on_message = message
client.on_subscribe = subscribe
client.connect()
client.loop_background()

# Serial port detection
def getPort():
    ports = serial.tools.list_ports.comports()
    for port in ports:
        if "USB Serial Device" in str(port):
            return str(port).split(" ")[0]
    return None

# Check for micro:bit connection
isMicrobitConnected = False
port = getPort()
if port:
    ser = serial.Serial(port=port, baudrate=115200)
    isMicrobitConnected = True

# Dictionary to hold the latest values
latest_data = {}

# Data processing
def processData(data):
    data = data.replace("!", "").replace("#", "")
    splitData = data.split(":")
    if len(splitData) == 2:
        feed_id, value = splitData
        print(f"Nhận từ microcontroller: {feed_id} = {value}")
        if feed_id in AIO_FEED_IDS:
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

# Main loop
feed_index = 0
while True:
    if isMicrobitConnected:
        readSerial()
        current_feed = AIO_FEED_IDS[feed_index]
        if current_feed in latest_data:
            value = latest_data[current_feed]
            print(f"Gửi tới {current_feed}: {value}")
            client.publish(current_feed, value)
        else:
            print(f"Chưa có dữ liệu cho {current_feed}, bỏ qua")
        feed_index = (feed_index + 1) % len(AIO_FEED_IDS)
        time.sleep(2)  # 2 seconds between sending each feed
