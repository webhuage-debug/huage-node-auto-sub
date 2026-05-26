import { getLastCollectorResults } from "../collector/githubCollector.js";
import { readCollectorRulesConfig, waitForRequestInterval } from "../collector/rateLimiter.js";
import type { CollectorResultSummary } from "../collector/collectorState.js";

export type GitHubFetchedContent = {
  repository: string;
  path: string;
  url: string;
  text: string;
};

export type GitHubContentReadResult = {
  ok: boolean;
  processedSources: number;
  fetchedFiles: number;
  rateLimited: boolean;
  lastError: string | null;
  contents: GitHubFetchedContent[];
};

const keywordCandidates = ["clash", "mihomo", "v2ray", "sing-box", "subscription", "nodes", "proxy"];

type GitHubContentItem = {
  name?: string;
  path?: string;
  type?: string;
};

function getNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getGitHubHeaders(raw = false): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
    "User-Agent": "huage-node-auto-sub"
  };

  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/token\s+[A-Za-z0-9_\-.]+/gi, "token [redacted]");
  }
  return "未知错误";
}

function isCandidatePath(pathName: string): boolean {
  const lower = pathName.toLowerCase();
  return (
    lower === "readme.md" ||
    lower === "readme" ||
    lower.endsWith(".txt") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".json") ||
    keywordCandidates.some((keyword) => lower.includes(keyword))
  );
}

function uniqueRepositories(results: CollectorResultSummary[], maxRepos: number): string[] {
  const repositories = new Set<string>();

  for (const result of results) {
    if (result.repository && result.repository !== "unknown") {
      repositories.add(result.repository);
    }
    if (repositories.size >= maxRepos) {
      break;
    }
  }

  return [...repositories];
}

function pathsFromSearchResults(repository: string, results: CollectorResultSummary[]): string[] {
  return results
    .filter((result) => result.repository === repository && result.path && result.path !== "repository")
    .map((result) => result.path);
}

async function readRepositoryRoot(repository: string): Promise<string[]> {
  const response = await fetch(`https://api.github.com/repos/${repository}/contents`, {
    headers: getGitHubHeaders()
  });

  if (response.status === 403 || response.status === 429) {
    throw new Error(`RATE_LIMIT:${response.status}`);
  }

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json().catch(() => [])) as unknown;
  const items = (Array.isArray(payload) ? payload : []) as GitHubContentItem[];
  return items
    .filter((item) => item.type === "file" && item.path && isCandidatePath(item.name || item.path))
    .map((item) => item.path as string);
}

async function fetchRawFile(repository: string, filePath: string, maxSizeBytes: number): Promise<GitHubFetchedContent | null> {
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`, {
    headers: getGitHubHeaders(true)
  });

  if (response.status === 403 || response.status === 429) {
    throw new Error(`RATE_LIMIT:${response.status}`);
  }

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  const size = Buffer.byteLength(text, "utf8");

  if (size > maxSizeBytes) {
    return null;
  }

  return {
    repository,
    path: filePath,
    url: `https://github.com/${repository}/blob/HEAD/${filePath}`,
    text
  };
}

export async function readLimitedGitHubContents(): Promise<GitHubContentReadResult> {
  const results = getLastCollectorResults().results;
  const rules = await readCollectorRulesConfig();
  const maxRepos = getNumberEnv("GITHUB_CONTENT_MAX_REPOS_PER_RUN", 10);
  const maxFilesPerRepo = getNumberEnv("GITHUB_CONTENT_MAX_FILES_PER_REPO", 5);
  const maxFileSizeBytes = getNumberEnv("GITHUB_CONTENT_MAX_FILE_SIZE_BYTES", 1048576);
  const maxTotalBytes = getNumberEnv("GITHUB_CONTENT_MAX_TOTAL_BYTES_PER_RUN", 5242880);
  const repositories = uniqueRepositories(results, maxRepos);
  const contents: GitHubFetchedContent[] = [];
  let totalBytes = 0;
  let rateLimited = false;
  let lastError: string | null = null;

  try {
    for (let repoIndex = 0; repoIndex < repositories.length; repoIndex += 1) {
      const repository = repositories[repoIndex];
      const candidatePaths = new Set<string>([
        ...pathsFromSearchResults(repository, results),
        "README.md",
        "README"
      ]);

      for (const rootPath of await readRepositoryRoot(repository)) {
        candidatePaths.add(rootPath);
      }

      let filesForRepo = 0;
      for (const filePath of candidatePaths) {
        if (!isCandidatePath(filePath) || filesForRepo >= maxFilesPerRepo || totalBytes >= maxTotalBytes) {
          continue;
        }

        const content = await fetchRawFile(repository, filePath, maxFileSizeBytes);
        await waitForRequestInterval(rules.github.request_interval_seconds);

        if (!content) {
          continue;
        }

        const size = Buffer.byteLength(content.text, "utf8");
        if (totalBytes + size > maxTotalBytes) {
          break;
        }

        contents.push(content);
        totalBytes += size;
        filesForRepo += 1;
      }

      if (repoIndex < repositories.length - 1) {
        await waitForRequestInterval(rules.github.request_interval_seconds);
      }
    }
  } catch (error) {
    const message = safeErrorMessage(error);
    if (message.startsWith("RATE_LIMIT:")) {
      rateLimited = true;
      lastError = `GitHub API 返回 ${message.replace("RATE_LIMIT:", "")}，已停止本轮内容读取。`;
    } else {
      lastError = message;
    }
  }

  return {
    ok: !lastError,
    processedSources: repositories.length,
    fetchedFiles: contents.length,
    rateLimited,
    lastError,
    contents
  };
}
