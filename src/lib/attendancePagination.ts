const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_PAGE_SIZE = 5000;

export function normalizeAttendancePagination(params: {
  page?: string | null;
  pageSize?: string | null;
  exportMode?: boolean;
}) {
  const parsedPage = Number.parseInt(params.page ?? '1', 10);
  const parsedPageSize = Number.parseInt(params.pageSize ?? String(DEFAULT_PAGE_SIZE), 10);

  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const requestedPageSize =
    Number.isNaN(parsedPageSize) || parsedPageSize < 1 ? DEFAULT_PAGE_SIZE : parsedPageSize;
  const maxPageSize = params.exportMode ? MAX_EXPORT_PAGE_SIZE : MAX_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, maxPageSize);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}
