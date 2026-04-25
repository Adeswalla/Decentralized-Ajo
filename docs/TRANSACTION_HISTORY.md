# Transaction History System

The Transaction History system provides a comprehensive record of all contributions made by a user across their Ajo circles. This document details the API integration, sorting, pagination, and blockchain verification.

## API Integration

### Endpoint
`GET /api/transactions`

### Authentication
Requires a valid JWT in the `Authorization` header:
`Authorization: Bearer <token>`

### Query Parameters
- `page` (number, default: 1): The page number to retrieve.
- `sortBy` (string, default: 'createdAt'): Field to sort by (`createdAt`, `amount`).
- `order` (string, default: 'desc'): Sort order (`asc`, `desc`).

### Response Format
The API returns a JSON object containing a list of contributions and pagination metadata.

```json
{
  "contributions": [
    {
      "id": "cm8o...",
      "amount": 100.5,
      "status": "COMPLETED",
      "createdAt": "2026-03-24T10:00:00Z",
      "txHash": "0x...",
      "circle": {
        "id": "circle123",
        "name": "Savings Group A"
      }
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

## Sorting and Pagination

### Pagination Strategy
- **Page Size**: Fixed at 20 items per page.
- **Client-side Handling**: The UI should calculate total pages as `ceil(total / limit)`.
- **Navigation**: Use the `page` query parameter to fetch subsequent results.

### Sorting Strategy
- **Default**: Newest transactions first (`sortBy=createdAt&order=desc`).
- **Options**: Users can toggle sorting by `amount` or `date`.

## Blockchain Hashes

Each completed contribution is associated with a `txHash` (Transaction Hash).

- **Verification**: The `txHash` represents the on-chain record of the contribution on the Polygon network.
- **Explorer Link**: Hashes should be linked to the Polygonscan explorer:
  `https://polygonscan.com/tx/{txHash}`
- **Security**: The system ensures hashes are stored securely and verified against the smart contract state during processing.
