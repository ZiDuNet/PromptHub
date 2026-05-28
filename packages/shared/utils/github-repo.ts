export interface ParsedGithubRepo {
  owner: string;
  repo: string;
  repositoryUrl: string;
  cloneUrl: string;
  protocol: "https" | "ssh";
}

export function parseGithubRepo(url: string): ParsedGithubRepo | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  const sshMatch = trimmed.match(
    /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/,
  );
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
      repositoryUrl: `https://github.com/${sshMatch[1]}/${sshMatch[2]}`,
      cloneUrl: trimmed,
      protocol: "ssh",
    };
  }

  const httpsMatch = trimmed.match(
    /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/tree\/[^/]+(?:\/.*)?)?\/?$/,
  );
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
      repositoryUrl: `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}`,
      cloneUrl: trimmed,
      protocol: "https",
    };
  }

  return null;
}
