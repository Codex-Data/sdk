import {
  FilterExchangesDocument,
  FilterExchangesQueryVariables,
  FilterPairsDocument,
  FilterPairsQueryVariables,
  FilterTokensDocument,
  FilterTokensQueryVariables,
  GetBarsDocument,
  GetDetailedPairStatsDocument,
  GetNetworksDocument,
  GetNetworkStatusDocument,
  GetSparklinesDocument,
  GetSparklinesQueryVariables,
  GetSymbolDocument,
  GetSymbolQueryVariables,
  GetTokenPriceDocument,
  GetTokensDocument,
  GetWebhooksDocument,
  ListPairsForTokenDocument,
  ListPairsForTokenQueryVariables,
  ListTopTokensDocument,
  PairEventsDocument,
  PairEventsQueryVariables,
  QueryGetBarsArgs,
  QueryGetDetailedPairStatsArgs,
  QueryGetNetworkStatusArgs,
  QueryGetTokenPricesArgs,
  QueryGetWebhooksArgs,
  QueryListTopTokensArgs,
  QueryTokenArgs,
} from "./generated/graphql";
import { Codex } from "./index";

export class Query {
  constructor(private sdk: Codex) {}
  pairEvents = async (vars: PairEventsQueryVariables) =>
    this.sdk.query(PairEventsDocument, vars);
  sparklines = async (vars: GetSparklinesQueryVariables) =>
    this.sdk.query(GetSparklinesDocument, vars);
  token = async (vars: QueryTokenArgs) =>
    this.sdk.query(GetTokensDocument, vars);
  price = async (vars: QueryGetTokenPricesArgs) =>
    this.sdk.query(GetTokenPriceDocument, vars);
  detailedPairStats = async (vars: QueryGetDetailedPairStatsArgs) =>
    this.sdk.query(GetDetailedPairStatsDocument, vars);
  bars = async (vars: QueryGetBarsArgs) =>
    this.sdk.query(GetBarsDocument, vars);
  topTokens = async (vars: QueryListTopTokensArgs) =>
    this.sdk.query(ListTopTokensDocument, vars);
  filterTokens = async (vars: FilterTokensQueryVariables) =>
    this.sdk.query(FilterTokensDocument, vars);
  filterPairs = async (vars: FilterPairsQueryVariables) =>
    this.sdk.query(FilterPairsDocument, vars);
  listPairsForToken = async (vars: ListPairsForTokenQueryVariables) =>
    this.sdk.query(ListPairsForTokenDocument, vars);
  filterExchanges = async (vars: FilterExchangesQueryVariables) =>
    this.sdk.query(FilterExchangesDocument, vars);
  symbol = async (vars: GetSymbolQueryVariables) =>
    this.sdk.query(GetSymbolDocument, vars);
  networks = async () => this.sdk.query(GetNetworksDocument);
  networkStatus = async (vars: QueryGetNetworkStatusArgs) =>
    this.sdk.query(GetNetworkStatusDocument, vars);
  getWebhooks = async (vars: QueryGetWebhooksArgs) =>
    this.sdk.query(GetWebhooksDocument, vars);
}
