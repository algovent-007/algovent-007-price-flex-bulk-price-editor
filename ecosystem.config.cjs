require("dotenv").config();

module.exports = {
  apps: [
    {
      name: "price-flex-production",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        ...process.env,
      },
    },
  ],
};
