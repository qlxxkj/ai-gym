const fs = require("fs");
const EXDB = JSON.parse(fs.readFileSync(process.argv[2] || "/tmp/openGym-slim.json", "utf8"));
const esc = s => String(s ?? "").replace(/'/g, "''").replace(/\t/g, " ");
const lines = EXDB.map(x => [
  esc(x.id), esc(x.name), esc(x.muscle),
  "{" + (x.muscles || []).map(m => esc(m)).join(",") + "}",
  esc(x.equipment), esc(x.target), esc(x.cat), esc(x.bodypart),
].join("\t"));
fs.writeFileSync("exercises.csv", lines.join("\n") + "\n");
console.log("rows:", lines.length, "bytes:", fs.statSync("exercises.csv").size);
