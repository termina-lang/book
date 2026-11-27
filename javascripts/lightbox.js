// Minimal lightbox for the book's diagrams: clicking a diagram image opens it
// large in an overlay on the same page (no navigation); clicking again closes.
// No build dependency; served as a static script.
document.addEventListener("DOMContentLoaded", function () {
  var imgs = document.querySelectorAll(".md-typeset img.diagram");
  if (!imgs.length) return;

  var overlay = document.createElement("div");
  overlay.className = "diagram-lightbox";
  var big = document.createElement("img");
  overlay.appendChild(big);
  document.body.appendChild(overlay);

  function close() { overlay.classList.remove("open"); }
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  imgs.forEach(function (im) {
    im.style.cursor = "zoom-in";
    im.addEventListener("click", function () {
      big.src = im.src;
      overlay.classList.add("open");
    });
  });
});
