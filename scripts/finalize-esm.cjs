const fs = require("node:fs");
const path = require("node:path");

function rewrite(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) rewrite(filename);
    else if (entry.name.endsWith(".mjs")) {
      const source = fs.readFileSync(filename, "utf8");
      fs.writeFileSync(
        filename,
        source.replace(/\bfrom (["'])(\.[^"']+)\.js\1/g, "from $1$2.mjs$1"),
      );
    }
  }
}

rewrite("dist-esm");
