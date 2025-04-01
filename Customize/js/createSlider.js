function createSlider(id, min, max, start, unit) {
  var slider = document.getElementById(id);
  noUiSlider.create(slider, {
    start: start,
    connect: [true, false],
    range: { min: min, max: max },
    step: 1,
  });
  var valueDisplay = document.getElementById(id.replace("-slider", "-value"));
  slider.noUiSlider.on("update", function (values) {
    valueDisplay.innerHTML = Math.round(values[0]) + " " + unit;
  });
}

createSlider("humidity-slider", 0, 100, 50, "%");
createSlider("infrared-slider", 0, 50, 25, "m");
createSlider("light-slider", 0, 1000, 500, "lm");
