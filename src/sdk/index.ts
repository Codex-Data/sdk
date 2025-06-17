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

  /**
   * @param apiKey - The api key to use for the requests.
   * @param apiConfig - The configuration to use for the requests.
   */
  constructor(
    private apiKey: string,
    private apiConfig?: Partial<ApiConfig>,
  ) {
    const config = this.parseConfig(this.apiConfig ?? {});
    this.queries = new Query(this);
    this.mutations = new Mutation(this);
    this.subscriptions = new Subscribe(this);

    this.client = this.createGraphQLClient(config);
    this.wsClient = this.createWebsocketClient(config);

    this.wsClient?.on("error", (error) => {
      console.error("Websocket error: ", error);
    });
  }

  private parseConfig(config: Partial<ApiConfig>) {
    invariant(this.apiKey, "apiKey must be defined");
    return Object.assign({}, defaultConfig, config);
  }

  private createGraphQLClient(config: ApiConfig) {
    return new GraphQLClient(config.apiUrl, {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
        Authorization: this.apiKey,
        "X-Apollo-Operation-Name": "query",
        ...config.headers,
      }),
    });
  }

  private createWebsocketClient(config: ApiConfig) {
    return config.ws
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

  /**
   * Need to update the headers on the websocket connection.
   * This is useful if the api key changes, or you need to modify the connection init params at all.
   * NOTE: it will dispose of the old connection, so all existing subscriptions will be closed.
   */
  public updateConfig(incomingConfig: Partial<ApiConfig>) {
    // If we have an existing websocket connection, dispose of it.
    if (this.wsClient) this.dispose();

    // Merge the incoming config with the existing config.
    const config = this.parseConfig(
      Object.assign({}, this.apiConfig, incomingConfig),
    );

    // Create a new websocket connection with the new headers.
    this.wsClient = this.createWebsocketClient(config);
    this.client = this.createGraphQLClient(config);

    this.wsClient?.on("error", (error) => {
      console.error("Websocket error: ", error);
    });
    this.wsClient?.on("closed", (er) => {
      console.log("Websocket closed", er);
    });
    this.wsClient?.on("connecting", () => {
      console.log("Websocket connecting");
    });
  }

  /**
   * Call this to dispose of the websocket connection, and make this class ready for garbage collection.
   * This will also close any open subscriptions.
   *
   * It's useful for when you need to modify some of the configuration, or when you're done with the class.
   */
  public async dispose() {
    this.wsClient?.dispose();
  }

  /**
   * This is the preferred way to execute queries.
   * @param doc - The graphql document node to execute.
   * @param args - The variables to pass to the document.
   * @returns The result of the query.
   */
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

  /**
   * This is functionally the same thing as the `query` method, but it's more expressive.
   * @param doc - The graphql document node to execute.
   * @param args - The variables to pass to the document.
   * @returns The result of the mutation.
   */
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

  /**
   * This should be used when you don't want to use graphql libaries to create a document node,
   * and would rather just pass in a string.
   * @param gqlString - The graphql document string to execute.
   * @param args - The variables to pass to the document.
   * @returns The result of the mutation.
   */
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

  /**
   * @param doc - The graphql document string to execute.
   * @param args - The variables to pass to the document.
   * @param sink - The sink to receive the results.
   * @returns A cleanup function to unsubscribe from the subscription.
   */
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
