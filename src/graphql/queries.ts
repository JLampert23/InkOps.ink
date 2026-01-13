import { gql } from '@apollo/client';

export const GET_INVOICES = gql`
  query GetInvoices($after: String, $first: Int = 25) {
    invoices(after: $after, first: $first) {
      edges {
        cursor
        node {
          id
          visualId
          status {
            name
          }
          createdAt
          invoiceAt
          dueAt
          paymentDueAt
          total
          subtotal
          salesTaxAmount
          paidInFull
          amountPaid
          amountOutstanding
          contact {
            id
            fullName
            email
            customer {
              id
              companyName
            }
          }
          lineItems {
            edges {
              node {
                id
                name
                description
                quantity
                price
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_PAYMENTS = gql`
  query GetPayments($after: String, $first: Int = 25) {
    transactions(after: $after, first: $first) {
      edges {
        cursor
        node {
          ... on Payment {
            id
            amount
            paymentMethod
            transactionDate
            processor
            processorName
            isPrintavoPayment
            timestamps {
              createdAt
            }
            transactedFor {
              ... on Invoice {
                id
                visualId
                contact {
                  id
                  firstName
                  lastName
                  fullName
                  email
                  customer {
                    id
                    companyName
                  }
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_QUOTES = gql`
  query GetQuotes($after: String, $first: Int = 10) {
    quotes(after: $after, first: $first) {
      edges {
        cursor
        node {
          id
          visualId
          total
          subtotal
          salesTaxAmount
          createdAt
          status {
            name
          }
          contact {
            id
            fullName
            email
            customer {
              id
              companyName
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_ESTIMATES = GET_QUOTES;

export const GET_CUSTOMERS = gql`
  query GetCustomers($after: String, $first: Int = 10) {
    customers(after: $after, first: $first) {
      edges {
        cursor
        node {
          id
          companyName
          primaryContact {
            id
            fullName
            email
            phone
          }
          timestamps {
            createdAt
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_CUSTOMER_FINANCIALS = gql`
  query GetCustomerFinancials($customerId: ID!) {
    customer(id: $customerId) {
      id
      companyName
      primaryContact {
        id
        fullName
        email
      }
      orders(first: 25) {
        edges {
          node {
            id
            visualId
            total
            status {
              name
            }
            createdAt
            transactions {
              edges {
                node {
                  ... on Payment {
                    id
                    amount
                    transactionDate
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_TASKS = gql`
  query GetTasks($after: String, $first: Int = 25) {
    tasks(after: $after, first: $first) {
      edges {
        cursor
        node {
          id
          name
          dueAt
          completedAt
          order {
            id
            visualId
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
