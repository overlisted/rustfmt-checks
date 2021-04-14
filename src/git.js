import simpleGit from "simple-git";
import exists from "./exists.js";

const update = async (git, remote) => {
  await git.removeRemote("origin");
  await git.addRemote("origin", remote);

  await git.fetch();
}

export const cloneRepo = async (installationToken, path, repository, revision) => {
  const isNew = !await exists(path);
  const repoUrl = `https://x-access-token:${installationToken}@github.com/${repository.full_name}.git`;

  if(isNew) {
    await simpleGit().clone(repoUrl, path);
  }

  const git = simpleGit(path);

  if(!isNew) await update(git, repoUrl);

  await git.checkout(revision);

  return git;
};

export const pushChanges = async (installationToken, path, repository, branch, commitMessage) => {
  const git = simpleGit(path);

  try {
    await git.add(".");
    await git.commit(commitMessage);
    await git.push(`https://x-access-token:${installationToken}@github.com/${repository.full_name}.git`, branch);
  } catch(e) {
    console.error(e);
  }
}
