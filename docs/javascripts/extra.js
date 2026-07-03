/* pwn.notes — small progressive enhancements.
   Keep it lightweight; the site must work fine with JS disabled. */

document.addEventListener("DOMContentLoaded", function () {
  // Konami code -> toggle a fun "CRT" class for the giggle. Zero side effects.
  const seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
  let pos = 0;
  document.addEventListener("keydown", function (e) {
    pos = e.keyCode === seq[pos] ? pos + 1 : 0;
    if (pos === seq.length) {
      document.body.classList.toggle("pwn-crt");
      pos = 0;
    }
  });
});
