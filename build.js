const esbuild = require("esbuild");
const fs = require("fs");
const React = require("react");
const http = require("http");
const { renderToString } = require("react-dom/server");
const path = require("path");

const build_page = async (path) => {
  // 1. Bundle JSX with element
  const {
    outputFiles: [{ text }],
  } = await esbuild.build({
    entryPoints: [path],
    format: "cjs",
    bundle: true,
    write: false,
    external: ["react", "react-dom"],
  });

  // 2. Bundle JSX with hydrate
  {
    const root_hydrate = fs.readFileSync("react-hydrate.jsx").toString();

    const new_root_hydrate = root_hydrate.replace(
      /(import Component from).*/,
      `import Component from "./${path}"`
    );

    fs.writeFileSync("react-hydrate.jsx", new_root_hydrate);

    await esbuild.build({
      entryPoints: ["react-hydrate.jsx"],
      bundle: true,
      watch: true,
      outfile: "dist/bundle.js",
      platform: "browser",
      inject: ["./react-shim.jsx"],
      define: {
        "process.env.NODE_ENV": '"production"',
      },
    });
  }

  // 3. Eval the bundle and get the exported component
  const Component = eval(`
    const exports = {};
    const module = { exports };
    ${text}
    module.exports.default;
  `);

  // 4. Inject to root
  const root_tree = fs.readFileSync("index.html").toString();
  const html = renderToString(React.createElement(Component));

  return root_tree.replace(
    `<div id="root"></div>`,
    `<div id="root">
      ${html}
      <script src="dist/bundle"></script>
    </div>`
  );
};

const server = http.createServer(async (req, res) => {
  const dir_pages = fs.readdirSync("src/pages");

  const find_page = dir_pages.find((page) => {
    /* 
      Params: ['app.jsx', 'other.jsx']
      Result: app
    */
    let get_path = page.replace(".jsx", "");

    /* 
      URL: http://localhost:3000/other
      Result: /other => other
    */
    let current_path = (function () {
      if (req.url === "/") return "app";

      return req.url.substring(1, req.url.length);
    })();

    return current_path === get_path;
  });

  if (find_page) {
    const get_page = await build_page(`src/pages/${find_page}`);
    res.write(get_page);
  }

  if (req.url === "/dist/bundle") {
    const bundle = fs.readFileSync("dist/bundle.js").toString();
    res.write(bundle);
  } else {
    if (!find_page) {
      res.write("not found");
    }
  }

  res.end();
});

server.listen(3000);
console.log("running port: 3000");

const preRenderPages = async (pagesDir = "src/pages") => {
  const pages = fs
    .readdirSync(pagesDir)
    .filter((file) => file.endsWith(".jsx"));

  for (const file of pages) {
    const name = file.replace(".jsx", "");
    const html = await build_page(`${pagesDir}/${file}`);

    const outPath = path.join(
      "dist",
      name === "app" ? "index.html" : `${name}.html`
    );

    fs.writeFileSync(outPath, html);
  }
};

preRenderPages();
