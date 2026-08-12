(function () {
  const init = () => {
    const placeholders = document.querySelectorAll("[data-festdaily-widget-id]");
    placeholders.forEach((el) => {
      if (el.dataset.festdailyWidgetInitialized) return;
      el.dataset.festdailyWidgetInitialized = "true";

      const id = el.getAttribute("data-festdaily-widget-id");
      if (!id) return;

      const iframe = document.createElement("iframe");
      const script = document.currentScript || Array.from(document.querySelectorAll("script")).find(s => s.src && s.src.includes("/embed.js"));
      const origin = script ? new URL(script.src).origin : window.location.origin;

      iframe.src = `${origin}/widget/${id}`;
      iframe.style.width = "100%";
      iframe.style.border = "none";
      iframe.style.overflow = "hidden";
      iframe.style.background = "transparent";
      iframe.style.transition = "height 0.2s ease";
      iframe.setAttribute("scrolling", "no");

      el.appendChild(iframe);

      window.addEventListener("message", (event) => {
        if (event.origin !== origin) return;
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (data && data.type === "festdaily-widget-resize" && data.widgetId === id) {
            iframe.style.height = `${data.height}px`;
          }
        } catch {
          // Swallow format errors
        }
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
