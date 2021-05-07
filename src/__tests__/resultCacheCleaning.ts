import gql from "graphql-tag";

import { ApolloClient } from "../core";

import { SchemaLink } from "../link/schema";

import { InMemoryCache, NormalizedCacheObject } from "../cache";
import { makeExecutableSchema } from "graphql-tools";

describe("resultCache cleaning", () => {
  const fragments = gql`
    fragment user on User {
      id
      name
    }

    fragment reaction on Reaction {
      id
      type
      author {
        ...user
      }
    }

    fragment message on Message {
      id
      author {
        ...user
      }
      reactions {
        ...reaction
      }
      viewedBy {
        ...user
      }
    }
  `;
  const query = gql`
    query getChat($id: ID!) {
      chat(id: $id) {
        id
        name
        members {
          ...user
        }
        messages {
          ...message
        }
      }
    }
    ${{ ...fragments }}
  `;
  function uuid(label: string) {
    return () =>
      `${label}-${Math.random()
        .toString(16)
        .substr(2)}`;
  }

  function emptyList(len: number) {
    return new Array(len).fill(true);
  }
  let client: ApolloClient<NormalizedCacheObject>;
  beforeEach(() => {
    const cache = new InMemoryCache();

    client = new ApolloClient({
      link: new SchemaLink({
        schema: makeExecutableSchema({
          typeDefs: `
                  type Query {
                    chat(id: ID!): Chat!
                  }

                  type Chat {
                    id: ID!
                    name: String!
                    messages: [Message!]!
                    members: [User!]!
                  }

                  type Message {
                    id: ID!
                    author: User!
                    reactions: [Reaction!]!
                    viewedBy: [User!]!
                    content: String!
                  }

                  type User {
                    id: ID!
                    name: String!
                  }

                  type Reaction {
                    id: ID!
                    type: String!
                    author: User!
                  }
              `,
          resolvers: {
            Query: {
              chat(_, { id }) {
                return id;
              },
            },
            Chat: {
              id(id) {
                return id;
              },
              name(id) {
                return id;
              },
              messages() {
                return emptyList(10);
              },
              members() {
                return emptyList(10);
              },
            },
            Message: {
              id: uuid("Message"),
              author() {
                return { foo: true };
              },
              reactions() {
                return emptyList(10);
              },
              viewedBy() {
                return emptyList(10);
              },
              content: uuid("Message-Content"),
            },
            User: {
              id: uuid("User"),
              name: uuid("User.name"),
            },
            Reaction: {
              id: uuid("Reaction"),
              type: uuid("Reaction.type"),
              author() {
                return { foo: true };
              },
            },
          },
        }),
      }),
      cache,
    });
  });

  afterEach(() => {
    const storeReader: any = (client.cache as any).storeReader;
    expect(storeReader.executeSubSelectedArray.size()).toBeGreaterThan(0);
    expect(storeReader.executeSelectionSet.size()).toBeGreaterThan(0);
    client.cache.evict({
      id: "ROOT_QUERY",
    });
    client.cache.gc();
    expect(storeReader.executeSubSelectedArray.size()).toEqual(0);
    expect(storeReader.executeSelectionSet.size()).toEqual(0);
  });

  it(`empties all result caches after eviction - query`, async () => {
    await client.query({
      query,
      variables: { id: 1 },
    });
  });

  it(`empties all result caches after eviction - watchQuery`, async () => {
    return new Promise<void>((r) => {
      const observable = client.watchQuery({
        query,
        variables: { id: 1 },
      });
      const unsubscribe = observable.subscribe(() => {
        unsubscribe.unsubscribe();
        r();
      });
    });
  });
});