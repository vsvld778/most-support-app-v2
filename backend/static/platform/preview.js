(() => {
    "use strict";

    const preview = document.querySelector("[data-preview]");
    const form = preview?.closest("form");
    if (!form) return;

    const title = form.elements.namedItem("title");
    const text = form.elements.namedItem("text");
    const visible = form.elements.namedItem("visible");
    const screen = preview.querySelector("[data-preview-screen]");
    const block = preview.querySelector("[data-preview-block]");
    const empty = preview.querySelector("[data-preview-empty]");
    const previewTitle = preview.querySelector("[data-preview-title]");
    const previewText = preview.querySelector("[data-preview-text]");
    const revision = preview.querySelector("[data-published-revision]");
    const published = {
        exists: revision.dataset.exists === "true",
        visible: revision.dataset.visible === "true",
        title: revision.querySelector("[data-revision-title]").textContent,
        text: revision.querySelector("[data-revision-text]").textContent,
    };
    let activeVersion = "draft";

    function render() {
        const draft = activeVersion === "draft";
        const content = draft ? {visible: visible.checked, title: title.value, text: text.value} : published;
        block.hidden = !content.visible;
        empty.hidden = content.visible;
        previewTitle.textContent = content.title;
        previewText.textContent = content.text;
        empty.textContent = draft || published.exists ? "Объявление скрыто." : "Объявление ещё не опубликовано.";
    }

    function switchOnClick(attribute, select) {
        const buttons = [...preview.querySelectorAll(`[data-preview-${attribute}]`)];
        for (const button of buttons) {
            button.addEventListener("click", () => {
                for (const item of buttons) item.setAttribute("aria-pressed", String(item === button));
                select(button.getAttribute(`data-preview-${attribute}`));
            });
        }
    }

    switchOnClick("width", width => { screen.dataset.width = width; });
    switchOnClick("version", version => {
        activeVersion = version;
        render();
    });
    title.addEventListener("input", render);
    text.addEventListener("input", render);
    visible.addEventListener("change", render);
    preview.querySelectorAll("[data-preview-controls]").forEach(control => { control.hidden = false; });
    render();
})();
