import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import pollHandler from "./api/poll.js";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "local-poll-api",
      configureServer(server) {
        const env = loadEnv(mode, process.cwd(), "");
        for (const key of [
          "POLL_WRITE_SECRET",
          "VITE_SUPABASE_URL",
          "VITE_SUPABASE_PUBLISHABLE_KEY",
        ])
          if (env[key]) process.env[key] = env[key];
        server.middlewares.use("/api/poll", async (req, res) => {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 4096) {
              res.statusCode = 413;
              res.end();
              return;
            }
          }
          req.body = body;
          res.status = (status) => {
            res.statusCode = status;
            return res;
          };
          res.json = (value) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(value));
            return res;
          };
          await pollHandler(req, res);
        });
      },
    },
  ],
}));
