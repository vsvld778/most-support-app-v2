/* Keep forms usable while iPhone browser chrome and the keyboard change height. */
(() => {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let pending = 0;
  let restingHeight = viewport?.height || innerHeight;
  let restingWidth = innerWidth;
  const isEditing = element => element?.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="button"]):not([type="submit"]), textarea, select');
  const update = () => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      const normalScale = !viewport || viewport.scale <= 1.05;
      const height = normalScale ? (viewport?.height || innerHeight) : innerHeight;
      const active = document.activeElement;
      const editing = isEditing(active);
      if (!editing) {
        restingHeight = height;
        restingWidth = innerWidth;
      } else if (restingWidth !== innerWidth) {
        // An open keyboard may resize both viewports during rotation.
        // The previous resting width becomes the new resting height.
        const wasKeyboard = root.dataset.mobileKeyboard === 'true';
        if (wasKeyboard && (innerWidth > restingWidth * 1.5 || innerWidth < restingWidth / 1.5)) {
          restingHeight = restingWidth;
        } else if (!wasKeyboard) {
          restingHeight = height;
        }
        restingWidth = innerWidth;
      }
      root.style.setProperty('--app-height', `${Math.round(height)}px`);
      root.dataset.mobileKeyboard = editing && normalScale && Math.max(restingHeight - height, innerHeight - height) > 150 ? 'true' : 'false';
      if (editing && normalScale && innerWidth <= 600) {
        const rect = active.getBoundingClientRect();
        const top = viewport?.offsetTop || 0;
        if (rect.top < top + 12 || rect.bottom > top + height - 12) {
          active.scrollIntoView({block: 'nearest', inline: 'nearest'});
        }
      }
    });
  };
  window.addEventListener('resize', update, {passive: true});
  window.addEventListener('orientationchange', update, {passive: true});
  viewport?.addEventListener('resize', update, {passive: true});
  viewport?.addEventListener('scroll', update, {passive: true});
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', update);
  update();
})();
