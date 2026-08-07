const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function loadEnvFile(filename) {
  const envPath = path.join(__dirname, filename);
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${filename}. Copy .env.staging to the server before starting PM2.`);
  }

  return dotenv.parse(fs.readFileSync(envPath));
}

module.exports = {
  apps: [
    {
      name: "price-flex-staging",
      cwd: __dirname,
      script: "./node_modules/.bin/react-router-serve",
      args: "./build/server/index.js",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        ...loadEnvFile(".env.staging"),
      },
    },
  ],
};
