# Asset deployment selections

`AssetDeployment.token` returns the deployed token's own data (price, name,
info, and so on), but the API always returns `null` for that token's `asset`
and `organization`. Without that cut, `token.asset.assetDeployments.token.asset`
would loop back on itself, and each level loads a token per deployment.

Generated SDK operations therefore no longer select `asset` or `organization`
beneath `AssetDeployment.token`. For example, `token.asset.assetDeployments.token`
still returns the deployment token's metadata, and
`token.organization.assets.assetDeployments` still lists every deployment, but
neither goes back into an asset or organization through a deployment token.
Because `Asset` is reachable only through those two fields,
`Asset.assetDeployments` now appears at most once along any path.

This removes the deployment token's `asset` and `organization` from generated
result types. Since the API returns `null` for them, no data is lost. Older SDK
versions and custom queries that still select them keep working and receive
`null`.

The generator tests check the token and pair operations against the committed
schema, and check every shipped document for these selections and for the depth
limit.
