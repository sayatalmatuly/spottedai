type QueryResultLike = {
  error?: {
    code?: string;
    message?: string;
  } | null;
};

function isMissingArchiveSchema(error: QueryResultLike['error']) {
  if (!error) return false;
  const referencesNewColumn = /is_archived|academic_year_start/i.test(error.message || '');
  return referencesNewColumn && (
    error.code === '42703'
    || error.code === 'PGRST204'
    || error.code === 'PGRST200'
  );
}

export async function withArchiveSchemaFallback<T>(
  currentQuery: () => PromiseLike<T>,
  legacyQuery: () => PromiseLike<T>
) {
  const currentResult = await currentQuery();
  const error = (currentResult as QueryResultLike).error;

  if (!isMissingArchiveSchema(error)) {
    return { result: currentResult, archiveSchemaAvailable: true };
  }

  return {
    result: await legacyQuery(),
    archiveSchemaAvailable: false,
  };
}