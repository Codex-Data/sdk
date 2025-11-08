# GraphQL Overrides

This directory contains manually-written GraphQL query, mutation, and subscription overrides that replace the auto-generated versions.

## Purpose

The SDK automatically generates GraphQL operations from the schema by fetching all available fields. However, sometimes you need to customize these operations to:

- **Reduce payload size** by selecting only needed fields
- **Improve performance** by avoiding expensive nested queries
- **Add custom fragments** or specific field selections
- **Work around codegen limitations** for complex queries

## How It Works

During the build process (`pnpm run generate:graphql`):

1. The script fetches the latest schema from the remote API
2. It auto-generates queries, mutations, and subscriptions with all available fields
3. **Before writing** each generated file, it checks if an override exists in this directory
4. If an override is found, it uses the override instead of the generated version

Generated files are written to: `src/resources/generated/queries/`, `src/resources/generated/mutations/`, and `src/resources/generated/subscriptions/`

## Directory Structure

```
overrides/
├── queries/           # Query overrides
├── mutations/         # Mutation overrides
└── subscriptions/     # Subscription overrides
```

## Creating an Override

1. Run `pnpm run generate:graphql` to see what gets auto-generated
2. Find the generated file in `src/resources/generated/queries/` (or mutations/subscriptions)
3. Copy it to the appropriate override directory here
4. Modify it to your needs
5. Re-run `pnpm run generate:graphql` to apply your override

## Example

**Auto-generated** (src/resources/generated/queries/GetWebhooks.graphql - before override):

```graphql
query GetWebhooks {
  webhooks {
    id
    url
    events
    createdAt
    updatedAt
    # ... 20+ more fields we don't need
  }
}
```

**Override** (src/overrides/queries/GetWebhooks.graphql):

```graphql
query GetWebhooks($bucketId: String, $bucketSortkey: String) {
  webhooks(bucketId: $bucketId, bucketSortkey: $bucketSortkey) {
    id
    url
    events
    # Only the fields we actually use
  }
}
```

## Important Notes

- Override files must have the **exact same filename** as the generated version (PascalCase)
- Overrides are **source-controlled** - commit them to git
- Generated files in `src/resources/generated/` are **not source-controlled** - they're regenerated on build
- When the schema changes, you may need to update your overrides manually

## Current Overrides

- **Queries**: FilterTokenWallets, GetEventLabels, GetNetworkConfigs, GetWebhooks
- **Mutations**: CreateWebhooks
- **Subscriptions**: OnEventLabelCreated
