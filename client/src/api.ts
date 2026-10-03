const API_BASE = "/api";

export interface ReleaseItem {
  id: string;
  releaseId: string;
  itemType: string;
  title: string;
  content: string;
  sortOrder: number;
  contentHash: string;
  displayId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Release {
  id: string;
  version: string;
  title: string;
  status: string;
  parentReleaseId: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ReleaseItem[];
  _count?: { items: number };
}

export interface CreateReleasePayload {
  version: string;
  title: string;
  items?: {
    itemType: string;
    title: string;
    content: string;
    sortOrder?: number;
  }[];
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || "Request failed");
  }
  return json.data as T;
}

export async function fetchReleases(): Promise<Release[]> {
  const res = await fetch(`${API_BASE}/releases`);
  return handleResponse<Release[]>(res);
}

export async function fetchRelease(id: string): Promise<Release> {
  const res = await fetch(`${API_BASE}/releases/${id}`);
  return handleResponse<Release>(res);
}

export interface ValidationSection {
  key: string;
  label: string;
  present: boolean;
  count: number;
}

export interface ValidationResult {
  valid: boolean;
  sections: ValidationSection[];
  issues: string[];
}

export async function validateRelease(id: string): Promise<ValidationResult> {
  const res = await fetch(`${API_BASE}/releases/${id}/validate`, {
    method: "POST"
  });
  return handleResponse<ValidationResult>(res);
}

export async function createRelease(payload: CreateReleasePayload): Promise<Release> {
  const res = await fetch(`${API_BASE}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<Release>(res);
}

export async function generateDemoRelease(): Promise<Release> {
  const res = await fetch(`${API_BASE}/releases/demo`, { method: "POST" });
  return handleResponse<Release>(res);
}

export async function updateRelease(id: string, payload: Partial<CreateReleasePayload>): Promise<Release> {
  const res = await fetch(`${API_BASE}/releases/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<Release>(res);
}

export async function finalizeRelease(id: string): Promise<Release> {
  const res = await fetch(`${API_BASE}/releases/${id}/finalize`, { method: "POST" });
  return handleResponse<Release>(res);
}

export async function createVersion(id: string, version: string): Promise<Release> {
  const res = await fetch(`${API_BASE}/releases/${id}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
  return handleResponse<Release>(res);
}

export interface Comparison {
  baseVersion: string;
  targetVersion: string;
  differences: {
    displayId: string;
    itemType: string;
    changeCategory: "ADDED" | "REMOVED" | "CHANGED" | "UNCHANGED";
    oldContent: string | null;
    newContent: string | null;
  }[];
  staleStatements: {
    id: string;
    text: string;
    reviewStatus: string;
    citedDisplayIds: string[];
    reasons: { displayId: string; reason: string }[];
  }[];
}

export async function compareVersions(id: string, otherId: string): Promise<Comparison> {
  const res = await fetch(`${API_BASE}/releases/${id}/compare/${otherId}`);
  return handleResponse<Comparison>(res);
}

export interface AiAnalysis {
  id: string;
  releaseId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error: string | null;
  resultJson: any; // We'll type this specifically if needed
  createdAt: string;
  updatedAt: string;
}

export async function analyzeRelease(id: string, force = false): Promise<AiAnalysis> {
  const res = await fetch(`${API_BASE}/releases/${id}/analyze`, { 
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force })
  });
  return handleResponse<AiAnalysis>(res);
}

export async function fetchAnalysis(id: string): Promise<AiAnalysis | null> {
  const res = await fetch(`${API_BASE}/releases/${id}/analysis`);
  if (res.status === 404) return null;
  return handleResponse<AiAnalysis>(res);
}

export interface Statement {
  id: string;
  releaseId: string;
  audience: "INTERNAL" | "CLIENT";
  statement: string;
  impact: "LOW" | "MEDIUM" | "HIGH";
  supportStatus: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED";
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  isStale: boolean;
  evidence: { releaseItem: ReleaseItem }[];
  reasons?: { displayId: string; reason: string }[];
}

export async function fetchStatements(releaseId: string): Promise<Statement[]> {
  const res = await fetch(`${API_BASE}/releases/${releaseId}/statements`);
  return handleResponse<Statement[]>(res);
}

export async function approveStatement(releaseId: string, statementId: string): Promise<Statement> {
  const res = await fetch(`${API_BASE}/releases/${releaseId}/statements/${statementId}/approve`, { method: "POST" });
  return handleResponse<Statement>(res);
}

export async function rejectStatement(releaseId: string, statementId: string): Promise<Statement> {
  const res = await fetch(`${API_BASE}/releases/${releaseId}/statements/${statementId}/reject`, { method: "POST" });
  return handleResponse<Statement>(res);
}

export async function resolveStatement(releaseId: string, statementId: string, note: string): Promise<Statement> {
  const res = await fetch(`${API_BASE}/releases/${releaseId}/statements/${statementId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  return handleResponse<Statement>(res);
}

export async function updateStatementContent(releaseId: string, statementId: string, statement: string): Promise<Statement> {
  const res = await fetch(`${API_BASE}/releases/${releaseId}/statements/${statementId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statement }),
  });
  return handleResponse<Statement>(res);
}
