import { QueryRevisions } from "./actions-types.ts";
import type { History as _History, Revision } from "./rest-types.ts";
import Wiki from "./wiki.ts";

/**
 * An iterable of a page's history, from newest to oldest.
 */
export class History
  implements AsyncIterable<Revision>, PromiseLike<Revision[]> {
  #filter?: "reverted" | "anonymous" | "bot" | "minor";
  #from?: number;
  #to?: number;
  #limit = Infinity;

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
    this.#filter = options?.filter;
    this.#from = options?.from;
    this.#to = options?.to;
    if (typeof options?.limit !== "undefined") {
      this.#limit = options?.limit;
    }
  }

  async *[Symbol.asyncIterator]() {
    if (this.wiki.polyfilled) {
      let response: _History = await this.wiki.request({
        path: `page/${this.title}/history`,
        params: {
          filter: this.#filter,
          older_than: this.#from,
        },
      });
      let count = 0;
      while (true) {
        for (const revision of response.revisions) {
          if (revision.id === this.#to) return;
          yield revision;
          count++;
          if (count >= this.#limit) return;
        }
        if (typeof response.older === "undefined") break;
        response = await fetch(response.older)
          .then((response) => response.json());
      }
    } else {
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
        rvlimit: this.#limit,
        rvstartid: this.#from,
        rvendid: this.#to,
        rvtag: this.#filter === "reverted" ? "mw-rollback" : undefined,
      };

      let response = await this.wiki.request({
        params: {
          ...params,
          prop: ["revisions", "contributors"],
          pcgroup: "bot",
          pclimit: "max", // Hopefully it'll never come across a page with too many bot contributors
        },
      }).then(QueryRevisions.check);
      const contributors = response.query.pages[0].contributors;

      let count = 0;
      while (true) {
        for (
          // Running them concurrently should make it faster, since they all need to fetch a second revision for the delta.
          const revision of await Promise.all(
            response.query.pages[0].revisions
              .filter((revision) => {
                switch (this.#filter) {
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
          if (revision.id === this.#to) return;
          yield revision;
          count++;
          if (count >= this.#limit) return;
        }
        if (
          typeof response.continue === "undefined" ||
          response.continue.rvcontinue === "undefined"
        ) {
          break;
        }
        response = await this.wiki.request({
          params: { ...params, rvcontinue: response.continue.rvcontinue },
        });
      }
    }
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
      { filter: this.#filter, from: id, to: this.#to, limit: this.#limit },
    );
  }

  newerThan(id: number) {
    return new History(
      this.wiki,
      this.title,
      { filter: this.#filter, from: this.#from, to: id, limit: this.#limit },
    );
  }

  filter(filter: "reverted" | "anonymous" | "bot" | "minor") {
    return new History(
      this.wiki,
      this.title,
      { filter, from: this.#from, to: this.#to, limit: this.#limit },
    );
  }

  limit(limit: number) {
    return new History(
      this.wiki,
      this.title,
      { filter: this.#filter, from: this.#from, to: this.#to, limit },
    );
  }

  // TODO: polyfill this, somehow
  count(
    /** Type of count */
    type: "anonymous" | "bot" | "editors" | "edits" | "minor" | "reverted",
    from: number,
    to: number,
  ) {
    return this.wiki.request({
      path: `page/${this.title}/history/counts/${type}`,
      params: { from, to },
    });
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
