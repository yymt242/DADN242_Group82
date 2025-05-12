function createSlider(id, min, max, start, unit) {
  const slider = document.getElementById(id);
  const valueDisplay = document.getElementById(id.replace("-slider", "-value"));

  // Initialize noUiSlider
  noUiSlider.create(slider, {
    start: start,
    connect: [true, false],
    range: { min: min, max: max },
    step: 1,
  });

  // Display the value on update
  slider.noUiSlider.on("update", function (values) {
    valueDisplay.innerHTML = Math.round(values[0]) + " " + unit;
  });
}

// Initialize the slider
createSlider("congsuat-slider", 10, 90, 70, "%");