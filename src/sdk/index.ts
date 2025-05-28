import { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { GraphQLClient, Variables } from "graphql-request";
import {
  Client as GraphQLWsClient,
  createClient,
  ExecutionResult,
  Sink,
} from "graphql-ws";
import WebSocket from "isomorphic-ws";

import { invariant } from "./invariant";
import { Mutation } from "./Mutation";
import { Query } from "./Query";
import { Subscribe } from "./Subscribe";

export type CleanupFunction = () => void;

export type ApiConfig = {
  // https://graph.codex.io/graphql
  apiUrl: string;

  // wss://graph.codex.io/graphql
  apiRealtimeUrl: string;

  // true if you want to connect a websocket, sometimes useful to turn this off in certain environments
  ws?: boolean;

  // Add static headers to the http requests
  headers?: Record<string, string>;

  // Add static headers to the ws requests
  wsHeaders?: Record<string, string>;

  // Use this to apply dynamic headers to the requests
  applyHeaders?: () => Promise<Record<string, string>>;
};

const defaultConfig: ApiConfig = {
  apiUrl: `https://graph.codex.io/graphql`,
  apiRealtimeUrl: `wss://graph.codex.io/graphql`,
  ws: true,
};

export class Codex {
  private client: GraphQLClient;
  private wsClient: GraphQLWsClient | undefined;
  public queries: Query;
  public mutations: Mutation;
  public subscriptions: Subscribe;

  constructor(
    private apiKey: string,
    private apiConfig?: Partial<ApiConfig>,
  ) {
    invariant(this.apiKey, "apiKey must be defined");
    const config = Object.assign({}, defaultConfig, apiConfig);

    this.queries = new Query(this);
    this.mutations = new Mutation(this);
    this.subscriptions = new Subscribe(this);
    this.client = new GraphQLClient(config.apiUrl, {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
        Authorization: this.apiKey,
        "X-Apollo-Operation-Name": "query",
        ...config.headers,
      }),
    });
    this.wsClient = config.ws
      ? createClient({
          webSocketImpl: WebSocket,
          keepAlive: 10_000, // ping server every 10 seconds
          url: config.apiRealtimeUrl,
          connectionParams: {
            Authorization: this.apiKey,
            ...config.wsHeaders,
          },
        })
      : undefined;
  }

  private async getRequestHeaders() {
    // Get any dynamic headers
    const dynamicHeaders = await this.apiConfig?.applyHeaders?.();
    const staticHeaders = this.apiConfig?.headers;
    const headers = {
      ...staticHeaders,
      ...dynamicHeaders,
    };
    return headers;
  }

  public async query<TResults, TVars extends Variables>(
    doc: TypedDocumentNode<TResults, TVars>,
    args: TVars = {} as TVars,
  ) {
    const res = await this.client.request<typeof doc>(
      doc,
      args,
      await this.getRequestHeaders(),
    );
    return res as TResults;
  }

  public async mutation<TResults, TVars extends Variables>(
    doc: TypedDocumentNode<TResults, TVars>,
    args: TVars = {} as TVars,
  ) {
    const res = await this.client.request<typeof doc>(
      doc,
      args,
      await this.getRequestHeaders(),
    );
    return res as TResults;
  }

  // Very simple network based fetch implementation, no compilation required
  public async send<TResults, V extends Variables = Variables>(
    gqlString: string,
    args: V = {} as V,
  ) {
    const res = await this.client.request<TResults>(
      gqlString,
      args,
      await this.getRequestHeaders(),
    );
    return res;
  }

  public subscribe<
    TResults,
    TVars extends Record<string, unknown> = Record<string, never>,
  >(
    doc: string,
    args: TVars,
    sink: Sink<ExecutionResult<TResults>>,
  ): CleanupFunction {
    if (!this.wsClient) {
      throw new Error("Websocket is not enabled in the config");
    }

    const cleanup = this.wsClient.subscribe<TResults>(
      {
        query: doc,
        variables: args,
      },
      sink,
    );
    return cleanup;
  }
}
