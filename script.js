function updateSliderValue() {
    document.getElementById('slider-value').innerText = document.getElementById('light-slider').value;
}

function toggleLock() {
    let lockStatus = document.getElementById('lock-status');
    lockStatus.innerText = lockStatus.innerText.includes("mở") ? "Đã khóa" : "Đã mở khóa";
}

function toggleAlarm() {
    let alarmStatus = document.getElementById('alarm-status');
    alarmStatus.innerText = alarmStatus.innerText.includes("bật báo động") ? "Đã tắt báo động" : "Đã bật báo động";
}