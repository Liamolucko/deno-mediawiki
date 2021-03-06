import {
  ActionsPage,
  ActionsRevision,
  QueryPageResponse,
  QueryHistoryResponse,
  QueryRevisionResponse,
} from "./actions-types.ts";
import { RevisionWithPage } from "./rest-types.ts";
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

  private async _fetch() {
    if (this.wiki.polyfilled) {
      const { query } = await this.wiki.request({
        params: {
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
        },
      }).then(QueryRevisionResponse.check);

      return this.wiki.convertRevision(
        query.pages[0].revisions[0],
        query.pages[0],
      );
    } else {
      return this.wiki.request({ path: `revision/${this.id}/bare` })
        .then(RevisionWithPage.check);
    }
  }

  /** Fetch computed properties */
  async fetch(): Promise<ResolvedRevision> {
    return new ResolvedRevision(
      this.wiki,
      await this._fetch(),
    );
  }

  // Async property accessors

  get user(): Promise<{ name: string; id: number | null }> {
    this.promise ??= this.fetch();

    return this.promise.then((revision) => revision.user);
  }

  get timestamp(): Promise<string> {
    this.promise ??= this.fetch();

    return this.promise.then((revision) => revision.timestamp);
  }

  get comment(): Promise<string | null> {
    this.promise ??= this.fetch();

    return this.promise.then((revision) => revision.comment);
  }

  get size(): Promise<number> {
    this.promise ??= this.fetch();

    return this.promise.then((revision) => revision.size);
  }

  get delta(): Promise<number | null> {
    this.promise ??= this.fetch();

    return this.promise.then((revision) => revision.delta);
  }

  get minor(): Promise<boolean> {
    this.promise ??= this.fetch();

    return this.promise.then((revision) => revision.minor);
  }

  get page(): Promise<{
    id: number;
    title: string;
  }> {
    this.promise ??= this.fetch();

    return this.promise.then((revision) => revision.page);
  }

  // Promise methods

  then<TResult1 = ResolvedRevision, TResult2 = never>(
    onfulfilled?:
      | ((value: ResolvedRevision) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.promise ??= this.fetch();

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
