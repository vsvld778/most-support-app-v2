(() => {
    "use strict";

    const preview = document.querySelector("[data-module-preview]");
    const mode = preview?.closest("form")?.elements.namedItem("mode");
    if (!mode) return;

    const labels = preview.querySelectorAll("[data-mode-label]");
    function render() {
        for (const label of labels) label.hidden = label.dataset.modeLabel !== mode.value;
    }

    mode.addEventListener("change", render);
    render();
    preview.hidden = false;
})();
