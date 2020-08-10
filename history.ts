import type { QueryResponse } from "./actions-api-types.d.ts";
import type { History as _History, Revision } from "./rest-api-types.d.ts";
import Wiki from "./wiki.ts";

/**
 * An iterable of a page's history, from newest to oldest.
 */
export class History implements AsyncIterable<Revision> {
  private _filter?: "reverted" | "anonymous" | "bot" | "minor";
  private from?: number;
  private to?: number;

  constructor(
    protected wiki: Wiki,
    protected title: string,
    options?: {
      filter?: "reverted" | "anonymous" | "bot" | "minor";
      from?: number;
      to?: number;
    },
  ) {
    this._filter = options?.filter;
    this.from = options?.from;
    this.to = options?.to;
  }

  // Polyfills

  // TODO: take filter into account for actions API
  iteratePolyfill = async function* (this: History) {
    await this.wiki.init();

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
      ],
      rvlimit: 20, // Not sure what it would be best to set this to
      ...(
        typeof this.from !== "undefined" &&
        typeof this.to !== "undefined" &&
        {
          rvstartid: this.from,
          rvendid: this.to - 1,
        }
      ),
    };

    let response: QueryResponse = await this.wiki.actionsRequest(params);
    while (true) {
      response = await this.wiki.actionsRequest(
        { ...params, continue: response.continue.rvcontinue },
      );
      if (
        typeof response.continue === "undefined" ||
        response.continue.rvcontinue === "undefined"
      ) {
        break;
      }
      for (
        // Running them concurrently should make it faster, since they all need to fetch a second revision for the delta.
        const revision of await Promise.all(
          response.query.pages[0].revisions.map((revision) =>
            this.wiki.convertRevision(revision)
          ),
        )
      ) {
        yield revision;
      }
    }
  };

  private iterate = async function* (this: History) {
    await this.wiki.init();

    let response: _History = await this.wiki.request(
      `page/${this.title}/history`,
      {
        ...(typeof this._filter !== "undefined" && { filter: this._filter }),
        ...(typeof this.from !== "undefined" && { older_than: this.from }),
      },
    );
    if (typeof this.from !== "undefined") {
      yield this.wiki.revision(this.from);
    }
    while (true) {
      for (const revision of response.revisions) {
        if (revision.id === this.to) return;
        yield revision;
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

  slice(from: number, to: number) {
    return new History(
      this.wiki,
      this.title,
      { filter: this._filter, from, to },
    );
  }

  filter(filter: "reverted" | "anonymous" | "bot" | "minor") {
    return new History(
      this.wiki,
      this.title,
      { filter, from: this.from, to: this.to },
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
}
