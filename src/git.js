import simpleGit from "simple-git";
import exists from "./exists.js";

export const cloneRepo = async (installationToken, path, repository, revision) => {
  const isNew = !await exists(path);

  if(isNew) {
    await simpleGit().clone(`https://x-access-token:${installationToken}@github.com/${repository.full_name}.git`, path);
  }

  const git = simpleGit(path);

  if(!isNew) await git.fetch();

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
