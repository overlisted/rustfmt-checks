import { App, createNodeMiddleware } from "@octokit/app";
import { createRun, beginRun, finishRun } from "./checkrun.js";
import { checkProject, checkRustfmt, formatProject } from "./rustfmt.js";
import { config } from "dotenv";
import { readFile } from "fs/promises";
import { cloneRepo, pull, pushChanges } from "./git.js";
import exists from "./exists.js";
import { createServer } from "http";
import { createOAuthUserAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";

config();

const logIntoInstallation = async (octokit, id) => {
  const credentials = await octokit.auth({
    type: "installation",
    installationId: id
  });

  return [new Octokit({ authStrategy: createOAuthUserAuth, auth: credentials }), credentials.token];
}

const main = async () => {
  if(!checkRustfmt()) {
    console.error("failed to detect rustfmt");

    return;
  }

  const github = new App({
    appId: process.env.APP_ID,
    privateKey: await readFile("private-key.pem").then(buffer => buffer.toString()),
    clientId: process.env.CLIENT_ID,
    oauth: {
      clientSecret: process.env.CLIENT_SECRET
    },
    webhooks: {
      secret: process.env.WEBHOOK_SECRET
    }
  });

  github.webhooks.on(
    ["check_suite.requested", "check_suite.rerequested", "check_run.rerequested"],
    async ({ octokit, payload }) => {
      const revision = payload.check_run?.head_sha ?? payload.check_suite?.head_sha;

      await createRun(octokit, payload.repository, revision);
  });

  github.webhooks.on("check_run.created", async ({ payload }) => {
    const [octokit, token] = await logIntoInstallation(github.octokit, payload.installation.id);
    const revision = payload.check_run?.head_sha ?? payload.check_suite?.head_sha;

    console.log("== check run ==");
    console.log("starting check run");
    await beginRun(octokit, payload.repository, payload.check_run);

    const path = `./repos/${payload.repository.full_name}`;
    console.log("cloning");
    await cloneRepo(token, path, payload.repository, revision);

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
    await finishRun(octokit, payload.repository, payload.check_run, conclusion, output, actions);
  });

  github.webhooks.on("check_run.requested_action", async ({ octokit, payload }) => {
    const [, token] = await logIntoInstallation(github.octokit, payload.installation.id);

    switch(payload.requested_action.identifier) {
      case "run_rustfmt": {
        const path = `./repos/${payload.repository.full_name}`;

        console.log("== check run action ==");
        console.log("updating the repo");
        await pull(token, path, payload.repository, payload.check_run.check_suite.head_branch);
        console.log("running rustfmt");
        await formatProject(path);
        console.log("pushing");
        await pushChanges(
          token,
          path,
          payload.repository,
          payload.check_run.check_suite.head_branch,
          "Run rustfmt"
        );

        break;
      }
    }
  });

  createServer(createNodeMiddleware(github)).listen(process.env.PORT);

  console.info(`im running (localhost:${process.env.PORT})`)
}

main();
