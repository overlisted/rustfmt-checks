export const createRun = (octokit, repo, head) => octokit.request(
  `POST /repos/${repo.full_name}/check-runs`,
  {
    accept: 'application/vnd.github.v3+json',
    name: "rustfmt",
    head_sha: head
  }
);

export const beginRun = (octokit, repo, run) => octokit.request(
  `PATCH /repos/${repo.full_name}/check-runs/${run.id}`,
  {
    accept: 'application/vnd.github.v3+json',
    name: "rustfmt",
    status: "in_progress",
    started_at: new Date().toISOString()
  }
);

export const finishRun = (octokit, repo, run, conclusion, output, actions) => octokit.request(
  `PATCH /repos/${repo.full_name}/check-runs/${run.id}`,
  {
    accept: 'application/vnd.github.v3+json',
    name: "rustfmt",
    status: "completed",
    conclusion,
    output,
    actions,
    completed_at: new Date().toISOString()
  }
);
