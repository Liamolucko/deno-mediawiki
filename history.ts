import type { QueryResponse } from "./actions-api-types.d.ts";
import type { History as _History, Revision } from "./rest-api-types.d.ts";
import Wiki from "./wiki.ts";

/**
 * An iterable of a page's history, from newest to oldest.
 */
export class History
  implements AsyncIterable<Revision>, PromiseLike<Revision[]> {
  private _filter?: "reverted" | "anonymous" | "bot" | "minor";
  private from?: number;
  private to?: number;
  private _limit = Number.POSITIVE_INFINITY;

  constructor(
    protected wiki: Wiki,
    protected title: string,
    options?: {
      filter?: "reverted" | "anonymous" | "bot" | "minor";
      from?: number;
      to?: number;
      limit?: number;
    },
  ) {
    this._filter = options?.filter;
    this.from = options?.from;
    this.to = options?.to;
    if (typeof options?.limit !== "undefined") {
      this._limit = options?.limit;
    }
  }

  // Polyfills
  iteratePolyfill = async function* (
    this: History,
    rvlimit: number | "max" = this._limit,
  ) {
    const params = {
      action: "query",
      titles: this.title,
      prop: "revisions",
      rvprop: [
        "ids",
        "timestamp",
        "flags",
        "size",
        "comment",
        "user",
        "userid",
        "tags",
      ],
      rvlimit,
      rvstartid: this.from,
      rvendid: this.to,
      rvtag: this._filter === "reverted" ? "mw-rollback" : undefined,
    };

    let response: QueryResponse = await this.wiki.actionsRequest(
      {
        ...params,
        prop: ["revisions", "contributors"],
        pcgroup: "bot",
        pclimit: "max", // Hopefully it'll never come across a page with too many bot contributors
      },
    );
    const contributors = response.query.pages[0].contributors;

    let count = 0;
    while (true) {
      for (
        // Running them concurrently should make it faster, since they all need to fetch a second revision for the delta.
        const revision of await Promise.all(
          response.query.pages[0].revisions
            .filter((revision) => {
              switch (this._filter) {
                case "anonymous":
                  return revision.anon ?? false;
                case "bot":
                  // I've only queried bot contributors, so all included contributors must be bots
                  return contributors.some((user) =>
                    user.userid === revision.userid
                  );
                case "minor":
                  return revision.minor;
                case "reverted":
                  return revision.tags.includes("mw-rollback");
                default:
                  return true;
              }
            })
            .map((revision) => this.wiki.convertRevision(revision)),
        )
      ) {
        if (revision.id === this.to) return;
        yield revision;
        count++;
        if (count >= this._limit) return;
      }
      if (
        typeof response.continue === "undefined" ||
        response.continue.rvcontinue === "undefined"
      ) {
        break;
      }
      response = await this.wiki.actionsRequest(
        { ...params, rvcontinue: response.continue.rvcontinue },
      );
    }
  };

  private iterate = async function* (this: History) {
    let response: _History = await this.wiki.request(
      `page/${this.title}/history`,
      {
        filter: this._filter,
        older_than: this.from,
      },
    );
    let count = 0;
    while (true) {
      for (const revision of response.revisions) {
        if (revision.id === this.to) return;
        yield revision;
        count++;
        if (count >= this._limit) return;
      }
      if (typeof response.older === "undefined") break;
      response = await fetch(response.older)
        .then((response) => response.json());
    }
  };

  [Symbol.asyncIterator]() {
    let iterator: AsyncGenerator<Revision, void, unknown>;

    return {
      next: async (...args: [] | [unknown]) => {
        if (typeof iterator === "undefined") {
          await this.wiki.init();
          iterator = this.wiki.polyfilled
            ? this.iteratePolyfill()
            : this.iterate();
        }

        return await iterator.next(...args);
      },
      return: async (value: void | PromiseLike<void>) => {
        if (typeof iterator === "undefined") {
          await this.wiki.init();
          iterator = this.wiki.polyfilled
            ? this.iteratePolyfill()
            : this.iterate();
        }

        return await iterator.return(value);
      },
      throw: async (e: any) => {
        if (typeof iterator === "undefined") {
          await this.wiki.init();
          iterator = this.wiki.polyfilled
            ? this.iteratePolyfill()
            : this.iterate();
        }

        return await iterator.throw(e);
      },
    };
  }

  async slice(from: number, to: number) {
    const history = this.olderThan(from);
    const arr = [
      {
        ...(await this.wiki.revision(from)).toJSON(),
        page: undefined,
      } as Revision,
    ];

    for await (const revision of history) {
      if (revision.id === to) break;
      arr.push(revision);
    }

    return arr;
  }

  olderThan(id: number) {
    return new History(
      this.wiki,
      this.title,
      { filter: this._filter, from: id, to: this.to, limit: this._limit },
    );
  }

  newerThan(id: number) {
    return new History(
      this.wiki,
      this.title,
      { filter: this._filter, from: this.from, to: id, limit: this._limit },
    );
  }

  filter(filter: "reverted" | "anonymous" | "bot" | "minor") {
    return new History(
      this.wiki,
      this.title,
      { filter, from: this.from, to: this.to, limit: this._limit },
    );
  }

  limit(limit: number) {
    return new History(
      this.wiki,
      this.title,
      { filter: this._filter, from: this.from, to: this.to, limit },
    );
  }

  // TODO: polyfill this, somehow
  count(
    /** Type of count */
    type: "anonymous" | "bot" | "editors" | "edits" | "minor" | "reverted",
    from: number,
    to: number,
  ) {
    return this.wiki.request(
      `page/${this.title}/history/counts/${type}`,
      { from: from.toString(), to: to.toString() },
    );
  }

  async toArray(): Promise<Revision[]> {
    const arr = [];

    for await (const revision of this) {
      arr.push(revision);
    }

    return arr;
  }

  then<TResult1 = Revision[], TResult2 = never>(
    onfulfilled?:
      | ((value: Revision[]) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.toArray().then(onfulfilled, onrejected);
  }
}

export default History;
