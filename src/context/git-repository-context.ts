import { createContext, useContext } from "react";

export const GIT_REPOSITORIES_QUERY_KEY = "git-repositories";

export const GitRepositoryContext = createContext<string | undefined>(
  undefined,
);
export const useGitRepositoryPath = () => useContext(GitRepositoryContext);
