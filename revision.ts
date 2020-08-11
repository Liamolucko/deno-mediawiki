import type {
  QueryResponse,
  ActionsPage,
  ActionsRevision,
} from "./actions-api-types.d.ts";
import type { RevisionWithPage } from "./rest-api-types.d.ts";
import Wiki from "./wiki.ts";

abstract class RevisionBase {
  protected abstract wiki: Wiki;
  abstract id: number;

  compare(to: number | string) {
    return this.wiki.compare(this.id, to);
  }
}

export class AsyncRevision extends RevisionBase
  implements PromiseLike<ResolvedRevision> {
  protected promise?: Promise<ResolvedRevision>;

  constructor(protected wiki: Wiki, public id: number) {
    super();
  }

  async fetchPolyfill() {
    return this.wiki.convertRevision(
      ...await this.wiki.actionsRequest({
        action: "query",
        revids: this.id,
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
      }).then((
        { query }: QueryResponse,
      ): [ActionsRevision, ActionsPage] => [
        query.pages[0].revisions[0],
        query.pages[0],
      ]),
    );
  }

  /** Fetch computed properties */
  async fetch(): Promise<ResolvedRevision> {
    await this.wiki.init();

    return new ResolvedRevision(
      this.wiki,
      await (this.wiki.polyfilled
        ? this.fetchPolyfill()
        : this.wiki.request(`revision/${this.id}/bare`)),
    );
  }

  // Async property accessors

  get user(): Promise<{ name: string; id: number | null }> {
    if (typeof this.promise === "undefined") {
      this.promise = this.fetch();
    }

    return this.promise.then((revision) => revision.user);
  }

  get timestamp(): Promise<string> {
    if (typeof this.promise === "undefined") {
      this.promise = this.fetch();
    }

    return this.promise.then((revision) => revision.timestamp);
  }

  get comment(): Promise<string | null> {
    if (typeof this.promise === "undefined") {
      this.promise = this.fetch();
    }

    return this.promise.then((revision) => revision.comment);
  }

  get size(): Promise<number> {
    if (typeof this.promise === "undefined") {
      this.promise = this.fetch();
    }

    return this.promise.then((revision) => revision.size);
  }

  get delta(): Promise<number | null> {
    if (typeof this.promise === "undefined") {
      this.promise = this.fetch();
    }

    return this.promise.then((revision) => revision.delta);
  }

  get minor(): Promise<boolean> {
    if (typeof this.promise === "undefined") {
      this.promise = this.fetch();
    }

    return this.promise.then((revision) => revision.minor);
  }

  get page(): Promise<{
    id: number;
    title: string;
  }> {
    if (typeof this.promise === "undefined") {
      this.promise = this.fetch();
    }

    return this.promise.then((revision) => revision.page);
  }

  // Promise methods

  then<TResult1 = ResolvedRevision, TResult2 = never>(
    onfulfilled?:
      | ((value: ResolvedRevision) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    if (typeof this.promise === "undefined") {
      this.promise = this.fetch();
    }

    return this.promise.then(onfulfilled, onrejected);
  }
}

export class ResolvedRevision extends RevisionBase implements RevisionWithPage {
  id: number;
  user: { name: string; id: number | null };
  timestamp: string;
  comment: string | null;
  size: number;
  delta: number | null;
  minor: boolean;
  page: {
    id: number;
    title: string;
  };

  constructor(protected wiki: Wiki, data: RevisionWithPage) {
    super();
    this.id = data.id;
    this.user = data.user;
    this.timestamp = data.timestamp;
    this.comment = data.comment;
    this.size = data.size;
    this.delta = data.delta;
    this.minor = data.minor;
    this.page = data.page;
  }

  // By default, the wiki is included, so I defined toJSON
  toJSON(): RevisionWithPage {
    return {
      id: this.id,
      page: this.page,
      size: this.size,
      minor: this.minor,
      timestamp: this.timestamp,
      user: this.user,
      comment: this.comment,
      delta: this.delta,
    };
  }
}
