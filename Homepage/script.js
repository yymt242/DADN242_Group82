const AIO_KEY = "aio_FdAg28NUZ1PArEY9IjaXGYcz6NRy";
const USERNAME = "yymt242";
const FEED_KEYS = {
    anhsang: "anhsang",
    doam: "doam",
    khoangcach: "khoangcach",
    led1: "led1",
    nhietdo: "nhietdo",
    quat: "quat"
};


let currentFeedIndex = 0;
const feedKeys = Object.values(FEED_KEYS);

async function fetchFeedData(feedKey) {
    const url = `https://io.adafruit.com/api/v2/${USERNAME}/feeds/${feedKey}/data?limit=1`;

    const response = await fetch(url, {
        headers: {
            "X-AIO-Key": AIO_KEY
        }
    });

    const data = await response.json();
    const latestValue = data[0]?.value;

    // Determine the unit based on the feedKey
    let unit = "";
    switch (feedKey) {
        case "anhsang":
            unit = " lm";
            break;
        case "khoangcach":
            unit = " m";
            break;
        case "nhietdo":
            unit = " °C";
            break;
        case "doam":
            unit = " %";
            break;
        default:
            unit = "";
    }

    if (feedKey === "quat" || feedKey === "led1") {
        document.getElementById(`${feedKey}-status`).textContent = latestValue === "1" ? "Bật" : "Tắt";
    }
    else {
        document.getElementById(`${feedKey}-status`).textContent = `${latestValue}${unit}`;
    }
}

function fetchFeedsInCircularManner() {
    const feedKey = feedKeys[currentFeedIndex];
    fetchFeedData(feedKey);

    currentFeedIndex = (currentFeedIndex + 1) % feedKeys.length;
}

// Call it once and then refresh every 1 second
fetchFeedsInCircularManner();
setInterval(fetchFeedsInCircularManner, 250);


async function sendFeedData(feedKey, value) {
    const url = `https://io.adafruit.com/api/v2/${USERNAME}/feeds/${feedKey}/data`;

    const formData = new FormData();
    formData.append("value", value);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "X-AIO-Key": AIO_KEY
        },
        body: formData
    });

    if (response.ok) {
        console.log(`Data sent to ${feedKey}: ${value}`);
        document.getElementById(`${feedKey}-status`).textContent = value === "1" ? "Bật" : "Tắt";
    } else {
        console.error(`Failed to send data to ${feedKey}`);
    }
}


document.addEventListener("DOMContentLoaded", () => {
    // Find all switches
    const switches = document.querySelectorAll(".switch input[type='checkbox']");

    switches.forEach((toggle, index) => {
        toggle.addEventListener("change", () => {
            const feedKey = index === 0 ? "quat" : "led1"; // Assuming first is quạt, second is đèn
            const value = toggle.checked ? "1" : "0"; // 1 = ON, 0 = OFF
            sendFeedData(feedKey, value);
        });
    });
});