/* Firebase configuration and initialization */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getDatabase, ref, get, set, onValue, off } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import { getAuth, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";




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
const storage = getStorage(app);
const fdb = getFirestore(app);

let analytics;
if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
}

window.firebase = {
    db,
    ref,
    get,
    set,
    onValue,
    off,
    auth,
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    storage,
    storageRef,
    uploadBytes,
    getDownloadURL,
    analytics,
    fdb,
    doc,
    getDoc,
    setDoc,
    updateDoc,
};



/* RUN ONCE WHEN INITIALIZING */

const SENSOR_FEEDS = ["anhsang", "doam", "khoangcach", "nhietdo"];
const ACTUATOR_FEEDS = ["quat", "led1", "door"];
let currentFeedIndex = 0;

const UNITS = {
    anhsang: " lm",
    khoangcach: " cm",
    nhietdo: " °C",
    doam: " %"
};
fetchFeedsInCircularManner();
setupAutoStatusListeners();
window.onload = updateAutoStatus;

// Check if user is signed in - Redirect to login if not signed in
const userEmail = localStorage.getItem('userEmail');
if (userEmail) {
    console.log('User is signed in:', userEmail);
} else {
    window.location.href = '/login.html';
}
let currentChart = null;
let chartData = [];
let currentListenerRef = null;
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
const alertAudio = new Audio('./audio/beep.wav');
alertAudio.loop = true;


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
    const initialTimeRange = document.querySelector("#time-range-buttons .active")?.dataset.range || "1m";

    fetchHistoricalData(initialFeedKey, initialTimeRange).then(data => {
        displayDataInChart(data);
        setupRealtimeChartUpdates(initialFeedKey); // Add real-time updates for the initial chart
    });

    const manualBtn = document.getElementById("manual-btn");
    const autoBtn = document.getElementById("auto-btn");
    const manualMode = document.querySelector(".manual-mode");
    const autoMode = document.querySelector(".auto-mode");

    function setMode(mode) {
        if (mode === "manual") {
            manualBtn.classList.add("active");
            autoBtn.classList.remove("active");
            manualMode.style.display = "block";
            autoMode.style.display = "none";
        } else if (mode === "auto") {
            autoBtn.classList.add("active");
            manualBtn.classList.remove("active");
            manualMode.style.display = "none";
            autoMode.style.display = "block";
        }

        // Save mode to Firebase
        set(ref(db, "mode"), mode);
    }

    // Event listeners
    manualBtn.addEventListener("click", () => setMode("manual"));
    autoBtn.addEventListener("click", () => setMode("auto"));

    // Get initial mode from Firebase
    onValue(ref(db, "mode"), (snapshot) => {
        const mode = snapshot.val();
        if (mode === "manual" || mode === "auto") {
            // Prevent double-writing when loading
            manualBtn.classList.remove("active");
            autoBtn.classList.remove("active");

            if (mode === "manual") {
                manualBtn.classList.add("active");
                manualMode.style.display = "block";
                autoMode.style.display = "none";
            } else {
                autoBtn.classList.add("active");
                manualMode.style.display = "none";
                autoMode.style.display = "block";
                setupAutoStatusListeners(); // Set up auto mode listeners
            }
        }
    });


    const sliders = [
        {
            sliderId: "distance-threshold-slider",
            valueId: "distance-threshold-value",
            dbKey: "thresholds/distance"
        },
        {
            sliderId: "light-threshold-slider",
            valueId: "light-threshold-value",
            dbKey: "thresholds/light"
        },
        {
            sliderId: "temp-threshold-slider",
            valueId: "temp-threshold-value",
            dbKey: "thresholds/temperature"
        }
    ];

    sliders.forEach(({ sliderId, valueId, dbKey }) => {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueId);
        const suffix = dbKey.includes("temperature") ? "°C" :
            dbKey.includes("light") ? " lm" :
                dbKey.includes("distance") ? " cm" : "";

        // Load initial value from Firebase
        onValue(ref(db, dbKey), (snapshot) => {
            const val = snapshot.val();
            if (val !== null) {
                slider.value = val;
                valueSpan.textContent = `${val}${suffix}`;
            }
        });

        // Update display and save to Firebase on input
        slider.addEventListener("input", () => {
            const val = parseInt(slider.value, 10);
            valueSpan.textContent = `${val}${suffix}`;
            set(ref(db, dbKey), val);
        });
    });


});


/* RUN IN INTERVALS */

setInterval(fetchFeedsInCircularManner, 50);
setInterval(updateChart, 333);
setInterval(updateAutoStatus, 100);


/* ASYNC FUNCTION */

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
            updateStatus(feedKey, value);
        }

        return value;
    } catch (err) {
        console.error(`Error fetching ${feedKey}:`, err);
        return null;
    }
}

// Fetch historical data for the selected feed and time range
async function fetchHistoricalData(feedKey, timeRange) {
    try {
        const endTime = Date.now();
        let startTime;

        switch (timeRange) {
            case '1m': startTime = endTime - (1 * 60 * 1000); break;
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

async function updateAutoStatus() {
    const isIntruder = await checkIntruder();

    const warningStatus = document.getElementById("warning-status");
    const khoangcachStatus = document.getElementById("khoangcach-status");
    const warningZone = document.querySelector(".warning-zone");
    const icon = document.getElementById("intruder-status-icon");

    if (isIntruder) {
        const warningRef = ref(db, 'warning');
        set(warningRef, "1");

        warningStatus.textContent = "Phát hiện có đột nhập";
        warningStatus.style.color = "white";
        warningZone.classList.add("blinking");
        warningZone.style.boxShadow = "0 0 20px rgba(255, 0, 0, 1)"; // Red glow
        icon.src = "./image/warning.png";
        khoangcachStatus.style.color = "red";

        if (alertAudio.paused) {
            alertAudio.play();
        }

        const doorRef = ref(db, 'door');
        set(doorRef, "0");
    } else {
        const warningRef = ref(db, 'warning');
        set(warningRef, "0");

        warningStatus.textContent = "Không có đột nhập";
        warningStatus.style.color = "black";
        warningZone.classList.remove("blinking");
        warningZone.style.boxShadow = "0 0 20px rgba(0, 255, 0, 1)"; // Green glow
        icon.src = "./image/safe.png";
        khoangcachStatus.style.color = "#0023c4";

        if (!alertAudio.paused) {
            alertAudio.pause();
            alertAudio.currentTime = 0;
        }
    }


    const anhsangStatus = document.getElementById("anhsang-status");
    const nhietdoStatus = document.getElementById("nhietdo-status");

    // If the mode is auto, do this
    const modeRef = ref(db, "mode");
    const modeSnapshot = await get(modeRef);
    const mode = modeSnapshot.val();
    if (mode !== "auto") {
        // Remove the highlight if in manual mode
        anhsangStatus.style.color = "#0023c4";
        nhietdoStatus.style.color = "#0023c4";
        return;
    }

    const lightThreshold = await get(ref(db, "thresholds/light")).then(snapshot => snapshot.val());
    const tempThreshold = await get(ref(db, "thresholds/temperature")).then(snapshot => snapshot.val());
    const lightValue = parseFloat(anhsangStatus.textContent.replace(" lm", ""));
    const tempValue = parseFloat(nhietdoStatus.textContent.replace(" °C", ""));
    if (lightValue < lightThreshold) {
        anhsangStatus.style.color = "red";
        // Turn on the light if it's off
        const ledRef = ref(db, 'led1');
        set(ledRef, "1");
        const lastrgbRef = ref(db, "lastRgb");
        const rgbRef = ref(db, "rgb");
        get(lastrgbRef).then(snapshot => {
            const lastColor = snapshot.val() || "#ffff00";
            set(rgbRef, lastColor);
        });
    } else {
        anhsangStatus.style.color = "#0023c4";
        // Turn off the light if it's on
        const ledRef = ref(db, 'led1');
        set(ledRef, "0");

        // Save last RGB color as current RGB color
        const lastrgbRef = ref(db, "lastRgb");
        get(ref(db, "rgb")).then(snapshot => {
            const currentColor = snapshot.val();
            if (currentColor && currentColor !== "#000000") {
                set(lastrgbRef, currentColor);
            }
        });

        const rgbRef = ref(db, "rgb");
        set(rgbRef, "#000000");
    }
    if (tempValue > tempThreshold) {
        nhietdoStatus.style.color = "red";
        // Turn on the fan if it's off
        const fanRef = ref(db, 'quat');
        const lastQuatRef = ref(db, 'lastQuat');
        const lastQuatSnapshot = await get(lastQuatRef);
        const lastQuatValue = lastQuatSnapshot.val() || "0";
        // Set the fan to the last known power level
        set(fanRef, lastQuatValue);
    } else {
        nhietdoStatus.style.color = "#0023c4";
        // Turn off the fan if it's on
        const fanRef = ref(db, 'quat');
        set(fanRef, "0");
    }
}

/* FUNCTION DEFINITION */

// Show user email in the header
function showUserEmail() {
    const email = localStorage.getItem("userEmail");
    if (email) {
        document.getElementById("user-email").textContent = `${email}`;
    }
}

function setupAutoStatusListeners() {
    const doorRef = ref(db, 'door');
    onValue(doorRef, snapshot => {
        const doorVal = Number(snapshot.val());
        const doorText = doorVal === 1 ? "Cửa: Mở" : "Cửa: Đóng";
        const doorEl = document.getElementById("distance-threshold-status");
        if (doorEl) doorEl.textContent = doorText;
        doorEl.className = doorVal === 1 ? "status blue" : "status gray";
    });

    const ledRef = ref(db, 'led1');
    onValue(ledRef, snapshot => {
        const ledVal = Number(snapshot.val());
        const ledText = ledVal === 1 ? "Đèn: Bật" : "Đèn: Tắt";
        const ledEl = document.getElementById("light-threshold-status");
        if (ledEl) ledEl.textContent = ledText;
        ledEl.className = ledVal === 1 ? "status blue" : "status gray";
    });

    const fanRef = ref(db, 'quat');
    onValue(fanRef, snapshot => {
        const fanVal = Number(snapshot.val());
        const fanText = fanVal > 0 ? "Quạt: Bật" : "Quạt: Tắt";
        const fanEl = document.getElementById("temp-threshold-status");
        if (fanEl) fanEl.textContent = fanText;
        fanEl.className = fanVal > 0 ? "status blue" : "status gray";
    });
}

function checkIntruder() {
    const value = parseFloat(document.getElementById("khoangcach-status").textContent.replace(" cm", ""));

    return get(ref(db, "thresholds/distance")).then(snapshot => {
        const threshold = snapshot.val();
        return value < threshold;
    });
}

function updateChart() {
    const feedKey = document.getElementById("feed-selector").value;
    const timeRange = document.querySelector("#time-range-buttons .active")?.dataset.range || "1m";

    // Run async code inside an IIFE
    (async () => {
        const data = await fetchHistoricalData(feedKey, timeRange);
        displayDataInChart(data);
        setupRealtimeChartUpdates(feedKey);
    })();
}

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
            animation: true,
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
            if (feedKey !== "door") {
                updateStatusElement(document.getElementById(`${feedKey}-status`), value);
            }

        });

        // Real-time update
        onValue(ref(db, feedKey), snapshot => {
            const value = snapshot.val();
            toggle.checked = value !== "0";
            if (feedKey !== "door") {
                updateStatusElement(document.getElementById(`${feedKey}-status`), value);
            }
        });
    });
}

function setupQuatPowerControl() {
    const slider = document.getElementById("congsuat-slider");
    const label = document.getElementById("congsuat-value");
    const quatCheckbox = document.querySelector(`input[data-feed="quat"]`);
    const sliderContainer = slider?.parentElement;

    if (!slider || !label || !sliderContainer) return;

    // Sync slider position from lastQuat only after the checkbox is toggled
    onValue(ref(db, "lastQuat"), snapshot => {
        const value = snapshot.val();
        if (value != null) {
            slider.value = value;
            label.textContent = `${value}%`;
        }
    });

    // When the checkbox is toggled
    quatCheckbox.addEventListener("change", async () => {
        const isChecked = quatCheckbox.checked;
        const power = isChecked ? slider.value : "0";  // Only set to slider value if checked
        await set(ref(db, "quat"), power); // Update the quat value based on slider or "0" if unchecked
    });

    // When user changes the slider
    slider.addEventListener("input", (e) => {
        const value = e.target.value;
        label.textContent = `${value}%`;
        set(ref(db, "lastQuat"), value);

        if (quatCheckbox?.checked) {
            set(ref(db, "quat"), value); // Update quat if checked
        }
    });

    // Live update power label + show/hide slider
    onValue(ref(db, "quat"), snapshot => {
        const value = snapshot.val();
        if (value != null) {
            label.textContent = `${value}%`;

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
            window.location.href = "../login/index.html";
        }).catch((error) => {
            alert("Đăng xuất không thành công: " + error.message);
        });
    });
}




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


function updateStatus(feed_id, value) {
    const statusSpan = document.getElementById(`${feed_id}-status`);
    const bar = document.getElementById(`${feed_id}-bar`);

    statusSpan.textContent = value;

    let min = 0, max = 100;

    switch (feed_id) {
        case "anhsang":
            min = 100;
            max = 1000;
            break;
        case "khoangcach":
            min = 0;
            max = 100;
            break;
        case "nhietdo":
            min = 20.0;
            max = 35.0;
            break;
        case "doam":
            min = 30;
            max = 90;
            break;
    }

    let percent = ((parseFloat(value) - min) / (max - min)) * 100;
    percent = Math.max(0, Math.min(100, percent)); // clamp between 0 and 100

    bar.style.width = percent + '%';
}
