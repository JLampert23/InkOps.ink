import { ApolloClient } from '@apollo/client';
import { DocumentNode } from 'graphql';

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface Edge<T> {
  cursor: string;
  node: T;
}

export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
}

export interface PaginationOptions {
  first?: number;
  maxPages?: number;
  onProgress?: (pageNumber: number, totalItems: number) => void;
}

export async function fetchAllPages<T>(
  client: ApolloClient<unknown>,
  query: DocumentNode,
  dataKey: string,
  variables: Record<string, unknown> = {},
  options: PaginationOptions = {}
): Promise<T[]> {
  const { first = 25, maxPages = 100, onProgress } = options;
  const allNodes: T[] = [];
  let hasNextPage = true;
  let after: string | null = null;
  let pageNumber = 0;

  while (hasNextPage && pageNumber < maxPages) {
    try {
      const result = await client.query({
        query,
        variables: {
          ...variables,
          after,
          first,
        },
        fetchPolicy: 'network-only',
      });

      console.log(`Query result for ${dataKey}:`, {
        data: result.data,
        errors: result.errors,
        error: result.error,
      });

      if (!result.data) {
        console.error('Full query result:', result);
        throw new Error(
          `No data returned from query for ${dataKey}. ` +
          `Errors: ${JSON.stringify(result.errors || result.error || 'unknown')}`
        );
      }

      const { data } = result;

      if (!data[dataKey]) {
        console.error('Response data:', data);
        throw new Error(
          `Expected data key "${dataKey}" not found in response. ` +
          `Available keys: ${Object.keys(data).join(', ')}`
        );
      }

      const connection = data[dataKey] as Connection<T>;

      if (!connection || !connection.edges) {
        break;
      }

      const nodes = connection.edges.map((edge) => edge.node);
      allNodes.push(...nodes);

      pageNumber++;
      hasNextPage = connection.pageInfo.hasNextPage;
      after = connection.pageInfo.endCursor;

      if (onProgress) {
        onProgress(pageNumber, allNodes.length);
      }

      if (nodes.length === 0) {
        break;
      }
    } catch (error) {
      console.error(`Error fetching page ${pageNumber}:`, error);
      throw error;
    }
  }

  return allNodes;
}

export async function fetchAllPagesWithRetry<T>(
  client: ApolloClient<unknown>,
  query: DocumentNode,
  dataKey: string,
  variables: Record<string, unknown> = {},
  options: PaginationOptions & { maxRetries?: number; retryDelay?: number } = {}
): Promise<T[]> {
  const { maxRetries = 3, retryDelay = 1000, ...paginationOptions } = options;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fetchAllPages<T>(client, query, dataKey, variables, paginationOptions);
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }
      console.warn(`Retry attempt ${attempt} after error:`, error);
      await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
    }
  }

  return [];
}
