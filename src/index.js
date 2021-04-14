import express from "express";
import { createAppAuth, createOAuthUserAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";
import { createRun, beginRun, finishRun } from "./checkrun.js";
import { checkProject, checkRustfmt, formatProject } from "./rustfmt.js";
import { config } from "dotenv";
import { readFile } from "fs/promises";
import { cloneRepo, pushChanges } from "./git.js";
import exists from "./exists.js";

config();

const main = async () => {
  if(!checkRustfmt()) {
    console.error("failed to detect rustfmt");

    return;
  }

  const app = express();

  app.use(express.json());

  app.post("/github", async (req, res) => {
    const { action, repository, check_run, check_suite, installation, requested_action } = req.body;
    const revision = check_run?.head_sha ?? check_suite?.head_sha;
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.APP_ID,
        privateKey: await readFile("private-key.pem").then(buffer => buffer.toString()),
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET
      }
    });
    const credentials = await octokit.auth({
      type: "installation",
      installationId: installation.id
    });
    const installationOctokit = new Octokit({ authStrategy: createOAuthUserAuth, auth: credentials });

    switch(req.header("X-GitHub-Event")) {
      case "check_suite": {
        switch(action) {
          case "rerequested":
          case "requested": {
            await createRun(installationOctokit, repository, revision);

            break;
          }
        }

        break;
      }
      case "check_run": {
        switch(action) {
          case "rerequested": {
            await createRun(installationOctokit, repository, revision);

            break;
          }
          case "created": {
            console.log("== check run ==");
            console.log("starting check run");
            await beginRun(installationOctokit, repository, check_run);

            const path = `./repos/${repository.full_name}`;
            console.log("cloning");
            await cloneRepo(credentials.token, path, repository, revision);

            console.log("checking rustfmt");
            const [conclusion, output, actions] = !await exists(`${path}/Cargo.toml`)
              ? [
                  "skipped",
                  {
                    summary: "The repository doesn't appear to use Cargo",
                    text: "This can't check repositories without a Cargo.toml in the root directory."
                  }
                ]
              : checkProject(path)
              ? ["success", { summary: "Rustfmt has found no formatting errors" }, []]
              : [
                  "failure",
                  {
                    summary: "Rustfmt has found formatting errors. Fix the errors by running rustfmt in your project.",
                  },
                  [{ label: "Reformat", description: "Run rustfmt for you", identifier: "run_rustfmt" }]
              ];

            output.title = "rustfmt"

            console.log("submitting the result");
            await finishRun(installationOctokit, repository, check_run, conclusion, output, actions);

            break;
          }
          case "requested_action": {
            switch(requested_action.identifier) {
              case "run_rustfmt": {
                const path = `./repos/${repository.full_name}`;

                console.log("== check run action ==");
                console.log("updating the repo");
                await cloneRepo(credentials.token, path, repository, check_run.check_suite.head_branch);
                console.log("running rustfmt");
                await formatProject(path);
                console.log("pushing");
                await pushChanges(
                  credentials.token,
                  path,
                  repository,
                  check_run.check_suite.head_branch,
                  "Run rustfmt"
                );

                break;
              }
            }

            break;
          }
        }

        break;
      }
    }

    res.status(200);
    res.end()
  });

  app.listen(process.env.PORT);
  console.info("im running")
}

main();
