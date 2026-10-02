export interface Workflow {
  nodeCount?: number;
  updatedAt?: number;
  definitionId: string;
  title: string;
  version: string;
  revision: string;
  packageName: string;
  packageVersion: string;
  packageStatus: string;
  directory: string;
}
