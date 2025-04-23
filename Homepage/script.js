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

    const statusEl = document.getElementById(`${feedKey}-status`);

    // For devices: update text and class
    if (feedKey === "led1" || feedKey === "quat") {
        const isOn = latestValue === "1";
        statusEl.textContent = isOn ? "Bật" : "Tắt";
        statusEl.className = `status ${isOn ? "blue" : "gray"}`;

        // Sync switch state
        const toggle = document.querySelector(`.switch input[data-feed="${feedKey}"]`);
        if (toggle) toggle.checked = isOn;
    } else {
        // For sensors: just update value + unit
        statusEl.textContent = `${latestValue}${unit}`;
    }
}

function fetchFeedsInCircularManner() {
    const feedKey = feedKeys[currentFeedIndex];
    fetchFeedData(feedKey);

    currentFeedIndex = (currentFeedIndex + 1) % feedKeys.length;
}

// Call it once and then refresh every 1 second
fetchFeedsInCircularManner();
setInterval(fetchFeedsInCircularManner, 350);


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
    const switches = document.querySelectorAll(".switch input[type='checkbox']");

    switches.forEach(toggle => {
        const feedKey = toggle.getAttribute("data-feed");
        toggle.addEventListener("change", () => {
            const value = toggle.checked ? "1" : "0";
            sendFeedData(feedKey, value);
        });
    });

    // Fetch initial values and sync UI
    fetchFeedData("quat");
    fetchFeedData("led1");
    fetchFeedData("anhsang");
    fetchFeedData("khoangcach");
    fetchFeedData("nhietdo");
    fetchFeedData("doam");
});
