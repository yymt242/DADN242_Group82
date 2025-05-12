import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getDatabase, ref, get, set, onValue, off } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCLE7kFEQc7ZIC9kgtY70auZ14NoLoltxQ",
    authDomain: "dadn242group82.firebaseapp.com",
    projectId: "dadn242group82",
    storageBucket: "dadn242group82.firebasestorage.app",
    messagingSenderId: "462160967009",
    appId: "1:462160967009:web:813fae07b129707bb4c120",
    measurementId: "G-V4M7Q5KX56",
    databaseURL: "https://dadn242group82-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const SENSOR_FEEDS = ["anhsang", "doam", "khoangcach", "nhietdo"];
const ACTUATOR_FEEDS = ["quat", "led1", "door"];
let currentFeedIndex = 0;

const UNITS = {
    anhsang: " lm",
    khoangcach: " cm",
    nhietdo: " °C",
    doam: " %"
};

window.firebase = { db, ref, get, set, onValue };

const userEmail = localStorage.getItem('userEmail');
if (userEmail) {
    console.log('User is signed in:', userEmail);
} else {
    window.location.href = '/login.html'; // Redirect to login if not signed in
}

// Fetch a single feed value and update the UI
async function fetchFeedData(feedKey) {
    try {
        const snapshot = await get(ref(db, feedKey));
        if (!snapshot.exists()) {
            console.warn(`${feedKey} has no data`);
            return null;
        }

        const value = snapshot.val();
        const el = document.getElementById(`${feedKey}-status`);
        if (el && SENSOR_FEEDS.includes(feedKey)) {
            el.textContent = `${value}${UNITS[feedKey] || ""}`;
        }

        return value;
    } catch (err) {
        console.error(`Error fetching ${feedKey}:`, err);
        return null;
    }
}

function fetchFeedsInCircularManner() {
    const feedKey = SENSOR_FEEDS[currentFeedIndex];
    fetchFeedData(feedKey);
    currentFeedIndex = (currentFeedIndex + 1) % SENSOR_FEEDS.length;
}

function updateStatusElement(el, value, onLabel = "Bật", offLabel = "Tắt") {
    if (!el) return;
    el.textContent = value !== "0" ? onLabel : offLabel;
    el.className = `status ${value !== "0" ? "blue" : "gray"}`;
}
function setupActuatorSwitches() {
    document.querySelectorAll(".switch input[type='checkbox']").forEach(toggle => {
        const feedKey = toggle.dataset.feed;
        if (!ACTUATOR_FEEDS.includes(feedKey)) return;

        toggle.addEventListener("change", async () => {
            const isChecked = toggle.checked;
            const value = isChecked ? "1" : "0";
            const timestamp = Date.now();  // Current timestamp in milliseconds

            // Send the latest value to Firebase
            await set(ref(db, feedKey), value);

            // Send historical value to Firebase (this is where we push the data with timestamp)
            const historyRef = ref(db, `sensor_history/${feedKey}/${timestamp}`);

            if (feedKey !== "quat") {
                {
                    await set(historyRef, {
                        value: value,
                        timestamp: timestamp
                    });
                }
            }

            if (feedKey === "quat") {
                const power = document.getElementById("congsuat-slider").value || "0";
                await set(ref(db, "quat"), isChecked ? power : "0");
            }

            // Optionally, for LED, store its color in the history too when turned on
            if (feedKey === "led1" && isChecked) {
                const color = document.getElementById("led1-color-picker").value || "#000000"; // Default to off color
                await set(ref(db, "rgb"), color);
            }
        });

        // Initial load
        fetchFeedData(feedKey).then(value => {
            if (value === null) return;
            toggle.checked = value !== "0";
            updateStatusElement(document.getElementById(`${feedKey}-status`), value);
        });

        // Real-time update
        onValue(ref(db, feedKey), snapshot => {
            const value = snapshot.val();
            toggle.checked = value !== "0";
            updateStatusElement(document.getElementById(`${feedKey}-status`), value);
        });
    });
}

function setupQuatPowerControl() {
    const slider = document.getElementById("congsuat-slider");
    const label = document.getElementById("congsuat-value");
    const quatCheckbox = document.querySelector(`input[data-feed="quat"]`);
    const sliderContainer = slider?.parentElement;
    const hiddenInput = document.getElementById("congsuat-hidden");

    if (!slider || !label || !sliderContainer || !hiddenInput || !quatCheckbox) return;

    // Sync slider position from lastQuat only after the checkbox is toggled
    onValue(ref(db, "lastQuat"), snapshot => {
        const value = snapshot.val();
        if (value != null) {
            // Update slider value and display percentage
            slider.noUiSlider.set(value);  // Use noUiSlider's set method to update the value
            label.textContent = `${value}%`;
            hiddenInput.value = value;  // Update hidden input as well
        }
    });

    // When the checkbox is toggled
    quatCheckbox.addEventListener("change", async () => {
        const isChecked = quatCheckbox.checked;
        const power = isChecked ? hiddenInput.value : "0";  // Set to slider value or "0"
        await set(ref(db, "quat"), power); // Update the quat value based on slider or "0" if unchecked
    });

    // When user changes the slider
    slider.noUiSlider.on("update", (values) => {
        const value = Math.round(values[0]);
        label.textContent = `${value}%`;
        hiddenInput.value = value;  // Sync with the hidden input
        set(ref(db, "lastQuat"), value); // Update lastQuat in the database

        if (quatCheckbox?.checked) {
            set(ref(db, "quat"), value); // Update quat if checked
        }
    });

    // Live update power label + show/hide slider
    onValue(ref(db, "quat"), snapshot => {
        const value = snapshot.val();
        if (value != null) {
            label.textContent = `${value}%`;

            // Show/hide slider based on quat value
            if (parseInt(value) === 0) {
                sliderContainer.style.display = "none";
            } else {
                sliderContainer.style.display = "block";
            }
        }
    });
}

function setupLEDControl() {
    const colorPicker = document.getElementById("led1-color-picker");
    const ledToggle = document.querySelector(`input[data-feed="led1"]`);
    const rgbRef = ref(db, "rgb");
    const lastrgbRef = ref(db, "lastRgb");
    const ledRef = ref(db, "led1");

    // Get the parent container <div class="device-sub">
    const colorPickerContainer = colorPicker?.closest(".device-sub");

    if (!colorPicker || !ledToggle || !colorPickerContainer) return;

    // When the toggle is changed (on/off)
    ledToggle.addEventListener("change", () => {
        const isChecked = ledToggle.checked;
        set(ledRef, isChecked ? "1" : "0");

        if (isChecked) {
            get(lastrgbRef).then(snapshot => {
                const lastColor = snapshot.val() || "#ffff00";
                set(rgbRef, lastColor);
            });
        } else {
            get(rgbRef).then(snapshot => {
                const currentColor = snapshot.val();
                if (currentColor && currentColor !== "#000000") {
                    set(lastrgbRef, currentColor);
                }
                set(rgbRef, "#000000");
            });
        }
    });

    // When color is picked and LED is ON
    colorPicker.addEventListener("input", () => {
        if (ledToggle.checked) {
            const selectedColor = colorPicker.value;
            set(rgbRef, selectedColor);
        }
    });

    // Always update the color picker to reflect current RGB value
    onValue(rgbRef, snapshot => {
        const value = snapshot.val();
        if (value && /^#([0-9A-F]{6})$/i.test(value)) {
            colorPicker.value = value;
        }
    });

    // Show/hide the entire container based on LED state
    onValue(ledRef, snapshot => {
        const ledValue = snapshot.val();
        colorPickerContainer.style.display = parseInt(ledValue) === 0 ? "none" : "block";
    });
}


function setupLogout() {
    document.getElementById("logout-link")?.addEventListener("click", (e) => {
        e.preventDefault();
        signOut(auth).then(() => {
            localStorage.removeItem("userEmail");
            window.location.href = "../Login/index.html";
        }).catch((error) => {
            alert("Đăng xuất không thành công: " + error.message);
        });
    });
}

function showUserEmail() {
    const email = localStorage.getItem("userEmail");
    if (email) {
        document.getElementById("user-email").textContent = email;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    SENSOR_FEEDS.forEach(fetchFeedData);  // Fetch initial data
    setupActuatorSwitches();
    setupQuatPowerControl();
    setupLEDControl();
    setupLogout();
    showUserEmail();

    // Add the setup for real-time listeners for the first time
    setupRealtimeListeners();

    const initialFeedKey = "anhsang"; // Explicitly set
    document.getElementById("feed-selector").value = initialFeedKey; // Set dropdown
    const initialTimeRange = document.querySelector("#time-range-buttons .active")?.dataset.range || "5m";

    fetchHistoricalData(initialFeedKey, initialTimeRange).then(data => {
        displayDataInChart(data);
        setupRealtimeChartUpdates(initialFeedKey); // Add real-time updates for the initial chart
    });

});

function setupRealtimeListeners() {
    // Set up real-time listeners for all sensor feeds
    SENSOR_FEEDS.forEach(feedKey => {
        const feedRef = ref(db, feedKey);
        onValue(feedRef, snapshot => {
            const value = snapshot.val();
            const el = document.getElementById(`${feedKey}-status`);
            if (el && value !== null) {
                el.textContent = `${value}${UNITS[feedKey] || ""}`;
            }
        });
    });

    // Set up a real-time listener for actuator feeds as well
    ACTUATOR_FEEDS.forEach(feedKey => {
        const feedRef = ref(db, feedKey);
        onValue(feedRef, snapshot => {
            const value = snapshot.val();
            const el = document.getElementById(`${feedKey}-status`);
            if (el && value !== null) {
                el.textContent = value !== "0" ? "Bật" : "Tắt";
                el.className = `status ${value !== "0" ? "blue" : "gray"}`;
            }

            if (feedKey === "quat") {
                const timestamp = Date.now();
                const historyRef = ref(db, `sensor_history/${feedKey}/${timestamp}`);
                set(historyRef, {
                    value: value,
                    timestamp: timestamp
                });
            }

            if (feedKey === "door") {
                const doorStatus = value !== "0" ? "Mở" : "Đóng";
                const doorEl = document.getElementById("door-status");
                if (doorEl) {
                    doorEl.textContent = doorStatus;
                    doorEl.className = `status ${value !== "0" ? "blue" : "gray"}`;
                }
            }
        });
    });
}


fetchFeedsInCircularManner();
setInterval(fetchFeedsInCircularManner, 100);


// Fetch historical data for the selected feed and time range
async function fetchHistoricalData(feedKey, timeRange) {
    try {
        const endTime = Date.now();
        let startTime;

        switch (timeRange) {
            case '5m': startTime = endTime - (5 * 60 * 1000); break;
            case '1h': startTime = endTime - (1 * 60 * 60 * 1000); break;
            case '5h': startTime = endTime - (5 * 60 * 60 * 1000); break;
            case '1d': startTime = endTime - (24 * 60 * 60 * 1000); break;
            case '1w': startTime = endTime - (7 * 24 * 60 * 60 * 1000); break;
            default: startTime = 0; // Show all data if no time range is selected
        }

        const historyRef = ref(db, `sensor_history/${feedKey}`);
        const snapshot = await get(historyRef);

        if (!snapshot.exists()) {
            console.warn(`No historical data for ${feedKey}`);
            return [];
        }

        const historyData = snapshot.val();
        const filteredData = [];

        // Filter the historical data based on the selected time range
        for (const timestamp in historyData) {
            if (historyData.hasOwnProperty(timestamp)) {
                if (parseInt(timestamp) >= startTime) {
                    filteredData.push({ timestamp: parseInt(timestamp), value: Number(historyData[timestamp].value) });
                }
            }
        }

        return filteredData;
    } catch (err) {
        console.error(`Error fetching historical data for ${feedKey}:`, err);
        return [];
    }
}
let currentChart = null;
let chartData = [];

function displayDataInChart(data) {
    const ctx = document.getElementById("data-chart").getContext("2d");

    chartData = data.map(item => ({
        x: new Date(item.timestamp),
        y: item.value
    }));

    if (currentChart) {
        currentChart.data.datasets[0].data = chartData;
        currentChart.update();
        return;
    }

    currentChart = new Chart(ctx, {
        type: "line",
        data: {
            datasets: [{
                label: "Dữ liệu theo thời gian",
                data: chartData,
                borderColor: "#0023c4",
                fill: false,
            }],
        },
        options: {
            responsive: true,
            animation: false,
            plugins: {
                legend: {
                    display: false // Hides the legend
                }
            },
            scales: {
                x: {
                    type: "time",
                    time: {
                        unit: "minute",
                        tooltipFormat: 'Pp',
                    },
                    title: {
                        display: true,
                        text: "Thời gian",
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: "Dữ liệu cảm biến",
                    },
                },
            },
        },
    });
}

let currentListenerRef = null;

function setupRealtimeChartUpdates(feedKey) {
    // Detach previous listener if any
    if (currentListenerRef) {
        off(currentListenerRef);
    }

    const historyRef = ref(db, `sensor_history/${feedKey}`);
    currentListenerRef = historyRef;

    onValue(historyRef, snapshot => {
        const data = snapshot.val();
        if (!data) return;

        const latestTimestamp = Math.max(...Object.keys(data).map(Number));
        const latestValue = data[latestTimestamp];

        const newPoint = {
            x: new Date(latestTimestamp),
            y: Number(latestValue.value)
        };

        // Avoid duplicate timestamps
        if (!chartData.find(point => point.x.getTime() === newPoint.x.getTime())) {
            chartData.push(newPoint);
            if (chartData.length > 100) chartData.shift(); // limit data points
            if (currentChart) {
                currentChart.data.datasets[0].data = chartData;
                currentChart.update();
            }
        }
    });
}

document.getElementById("feed-selector").addEventListener("change", async () => {
    const feedKey = document.getElementById("feed-selector").value;
    const timeRange = document.querySelector("#time-range-buttons .active")?.dataset.range || "5m";

    const data = await fetchHistoricalData(feedKey, timeRange);
    displayDataInChart(data);
    setupRealtimeChartUpdates(feedKey);
});

const timeRangeButtons = document.querySelectorAll("#time-range-buttons button");
timeRangeButtons.forEach(button => {
    button.addEventListener("click", async () => {
        timeRangeButtons.forEach(b => b.classList.remove("active"));
        button.classList.add("active");
        const timeRange = button.dataset.range;
        const feedKey = document.getElementById("feed-selector").value;
        const data = await fetchHistoricalData(feedKey, timeRange);
        displayDataInChart(data);
    });
});
document.getElementById("feed-selector").addEventListener("change", async () => {
    const feedKey = document.getElementById("feed-selector").value;
    const timeRange = document.querySelector("#time-range-buttons .active")?.dataset.range || "5m";
    const data = await fetchHistoricalData(feedKey, timeRange);
    displayDataInChart(data);
});


// Create Audio object once globally
const alertAudio = new Audio('./audio/beep.wav');
alertAudio.loop = true;

function checkIntruder() {
    const khoangcachStatus = document.getElementById("khoangcach-status");
    const threshold = 50;
    const value = parseFloat(khoangcachStatus.textContent.replace(" cm", ""));
    return value > threshold;
}

function updateIntruderStatus() {
    const isIntruder = checkIntruder();
    const warningStatus = document.getElementById("warning-status");

    const anhsangStatus = document.getElementById("anhsang-status");
    const khoangcachStatus = document.getElementById("khoangcach-status");
    const nhietdoStatus = document.getElementById("nhietdo-status");
    const doamStatus = document.getElementById("doam-status");

    const warningZone = document.querySelector(".warning-zone");
    const icon = document.getElementById("intruder-status-icon");

    if (isIntruder) {
        warningStatus.textContent = "Phát hiện có đột nhập";
        warningStatus.style.color = "white";
        warningZone.classList.add("blinking");
        icon.src = "./image/warning.png";

        doamStatus.style.color = "red";
        khoangcachStatus.style.color = "red";
        nhietdoStatus.style.color = "red";
        anhsangStatus.style.color = "red";

        // Play audio
        if (alertAudio.paused) {
            alertAudio.play();
        }
    } else {
        warningStatus.textContent = "Không có đột nhập";
        warningStatus.style.color = "black";
        warningZone.classList.remove("blinking");
        icon.src = "./image/safe.png";

        doamStatus.style.color = "#0023c4";
        khoangcachStatus.style.color = "#0023c4";
        nhietdoStatus.style.color = "#0023c4";
        anhsangStatus.style.color = "#0023c4";

        // Stop audio
        if (!alertAudio.paused) {
            alertAudio.pause();
            alertAudio.currentTime = 0;
        }
    }
}

setInterval(updateIntruderStatus, 100);
window.onload = updateIntruderStatus;