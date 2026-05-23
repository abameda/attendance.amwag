export const DEFAULT_EMPLOYEE_LIMIT = 3;
export const EMPLOYEE_PAGE_SIZE = 24;

export type EmployeeOption = {
  id: string;
  full_name: string;
  email: string;
  branch: string | null;
  branch_id?: string | null;
  job_title: string | null;
};

export type EmployeeListPagination = {
  page: number;
  pageSize: number;
  offset: number;
};

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeEmployeeListParams(params: URLSearchParams): EmployeeListPagination {
  const page = parsePositiveInteger(params.get('page'), 1);
  const requestedPageSize = parsePositiveInteger(
    params.get('pageSize') ?? params.get('limit'),
    DEFAULT_EMPLOYEE_LIMIT
  );
  const pageSize = Math.min(requestedPageSize, EMPLOYEE_PAGE_SIZE);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function filterEmployeeOptions(options: EmployeeOption[], query: string): EmployeeOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return options;
  }

  return options.filter((employee) => {
    const haystack = [
      employee.full_name,
      employee.email,
      employee.branch,
      employee.job_title,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
