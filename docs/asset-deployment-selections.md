# Asset deployment selection change

Generated SDK operations now select `Asset.assetDeployments` at most once along
any root-to-leaf path. For example, `token.asset.assetDeployments` remains, while
`token.asset.assetDeployments.token.asset.assetDeployments` is omitted. The same
rule applies through `organization.assets`. Independent sibling selections and
deployment token metadata remain available. The existing generator depth cap
still applies.

This changes generated result types: consumers reading the omitted nested
properties must update their code. It does not change the GraphQL schema or
rewrite custom queries. Previously installed SDK versions keep sending their
old documents until consumers upgrade.

Release this SDK before enabling the supergraph traversal guard. Keep the
supergraph in observe mode while consumers migrate, check violations from both
SDK and custom queries, and only enable enforcement after that compatibility
gate. A new SDK release alone does not make older clients compatible.

The generator regression tests validate token/pair selections against the
committed schema and check all shipped documents against the deployment and
depth limits. Generated sources must accompany the generator change. The
repository release workflow regenerates sources again at publication time.
