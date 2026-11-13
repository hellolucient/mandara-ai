import { createServer } from "node:http";

const port = Number(process.env.SANDBOX_PORT || 8765);

const login = `<!doctype html>
<html><head><title>DSR sandbox</title></head>
<body>
  <p>Local sandbox. This is not Mandara's DSR.</p>
  <form method="post" action="/login">
    <label>Username <input id="username" name="username"></label>
    <label>Password <input id="password" name="password" type="password"></label>
    <button id="submit" type="submit">Sign in</button>
  </form>
</body></html>`;

const report = `<!doctype html>
<html><head><title>DSR sandbox report</title></head>
<body>
  <p id="business-date">2026-11-12</p>
  <p id="currency">USD</p>
  <table id="sales-table">
    <thead><tr><th>Location</th><th>Net</th><th>Treatments</th><th>Budget</th></tr></thead>
    <tbody>
      <tr>
        <td data-field="location">Cinnamon Velifushi</td>
        <td data-field="net">5100</td>
        <td data-field="treatments">34</td>
        <td data-field="budget">4500</td>
      </tr>
      <tr>
        <td data-field="location">South Ari Spa</td>
        <td data-field="net">-40</td>
        <td data-field="treatments">16</td>
        <td data-field="budget">2900</td>
      </tr>
      <tr>
        <td data-field="location">Baa Atoll Spa</td>
        <td data-field="net"></td>
        <td data-field="treatments"></td>
        <td data-field="budget">2100</td>
      </tr>
    </tbody>
  </table>
</body></html>`;

const server = createServer((request, response) => {
  const signedIn = (request.headers.cookie ?? "").includes("dsr=1");
  if (request.method === "POST" && request.url === "/login") {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const params = new URLSearchParams(body);
      if (!params.get("username") || !params.get("password")) {
        response.writeHead(401, { "content-type": "text/html" });
        response.end("<p id='login-failed'>Sign-in failed.</p>");
        return;
      }
      response.writeHead(302, { location: "/report", "set-cookie": "dsr=1; HttpOnly; Path=/" });
      response.end();
    });
    return;
  }
  if (request.url === "/report") {
    if (!signedIn) {
      response.writeHead(302, { location: "/" });
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(report);
    return;
  }
  response.writeHead(200, { "content-type": "text/html" });
  response.end(login);
});

server.listen(port, "127.0.0.1");
