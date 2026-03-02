import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const httpLink = new HttpLink({
  uri: `${SUPABASE_URL}/functions/v1/printavo-proxy`,
});

const authLink = new ApolloLink((operation, forward) => {
  operation.setContext({
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  return forward(operation);
});

const errorLink = onError(({ graphQLErrors, networkError, operation, response }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path}`
      );
    });
  }

  if (networkError) {
    console.error(`[Network error]:`, networkError);
    console.error('Operation:', operation.operationName);
    console.error('Variables:', operation.variables);

    if ('result' in networkError) {
      console.error('Error response body:', networkError.result);
    }
    if ('statusCode' in networkError) {
      console.error('Status code:', networkError.statusCode);
    }
  }

  if (response) {
    console.error('Full response:', response);
  }
});

const retryLink = new ApolloLink((operation, forward) => {
  return forward(operation);
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, retryLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          invoices: {
            keyArgs: false,
            merge(existing, incoming) {
              if (!incoming) return existing;
              if (!existing) return incoming;

              return {
                ...incoming,
                edges: [...(existing.edges || []), ...(incoming.edges || [])],
              };
            },
          },
          payments: {
            keyArgs: false,
            merge(existing, incoming) {
              if (!incoming) return existing;
              if (!existing) return incoming;

              return {
                ...incoming,
                edges: [...(existing.edges || []), ...(incoming.edges || [])],
              };
            },
          },
          estimates: {
            keyArgs: false,
            merge(existing, incoming) {
              if (!incoming) return existing;
              if (!existing) return incoming;

              return {
                ...incoming,
                edges: [...(existing.edges || []), ...(incoming.edges || [])],
              };
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
  },
});
