self.addEventListener("fetch", (event) => {
  if (self.location.hostname !== "motorclub.co.il") return;
  if (event.request.mode !== "navigate") return;
  const url = new URL(event.request.url);
  url.hostname = "www.motorclub.co.il";
  url.protocol = "https:";
  event.respondWith(Response.redirect(url.href, 301));
});
