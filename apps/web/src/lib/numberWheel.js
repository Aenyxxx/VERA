/**
 * Decision 35 follow-up: the mouse wheel must not change a focused number field (the browser steps the value).
 * Blurring the field on wheel keeps its value and lets the page scroll as usual. Installed once in main.jsx;
 * returns the uninstall function.
 */
export function preventNumberWheel(doc = document) {
  function onWheel(event) {
    const field = event.target;
    if (field instanceof HTMLInputElement && field.type === "number" && field === doc.activeElement) field.blur();
  }
  doc.addEventListener("wheel", onWheel, { passive: true });
  return () => doc.removeEventListener("wheel", onWheel);
}
