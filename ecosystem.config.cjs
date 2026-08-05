const path = require("path");

// PM2 may still have old env vars from Render — override from .env
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true,
});

module.exports = {
  apps: [
    {
      name: "price-flex-production",
      cwd: __dirname,
      script: "./node_modules/.bin/react-router-serve",
      args: "./build/server/index.js",
      env: {
        NODE_ENV: "production",
        SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
        SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
        DATABASE_URL: process.env.DATABASE_URL,
        SCOPES: process.env.SCOPES,
        SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
      },
    },
  ],
};
