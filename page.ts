import * as rt from "https://stupid-extensions.com/denopkg.com/Liamolucko/runtypes@export-type/src/index.ts";
import { ParseLanglinks, ParseText, QueryImage, QueryPages } from "./actions-types.ts";
import { History } from "./history.ts";
import { PageLanguage, PageWithSource, WikiFile } from "./rest-types.ts";
import Wiki from "./wiki.ts";

/** An object representing a wiki page. */
abstract class PageBase {
  protected abstract wiki: Wiki;
  abstract title: string;

  get languages(): Promise<PageLanguage[]> {
    if (this.wiki.polyfilled) {
      return this.wiki.request({
        params: {
          action: "parse",
          prop: "langlinks",
        },
      })
        .then(ParseLanglinks.check)
        .then(({ parse }) =>
          parse.langlinks.map(({ lang, autonym, title }) => ({
            code: lang,
            name: autonym,
            key: title.replace(" ", "_"),
            title,
          }))
        );
    } else {
      return this.wiki.request({ path: `page/${this.title}/links/language` })
        .then(rt.Array(PageLanguage).check);
    }
  }

  get files(): Promise<{ files: WikiFile[] }> {
    if (this.wiki.polyfilled) {
      return this.wiki.request({
        params: {
          action: "query",
          titles: this.title,
          prop: "images",
        },
      })
        .then(QueryImage.check)
        .then(async ({ query }) => ({
          files: await Promise.all(
            query.pages[0].images.map(async (image) => ({
              ...await this.wiki.file(image.title),
              thumbnail: undefined,
            })),
          ),
        }));
    } else {
      return this.wiki.request({ path: `page/${this.title}/links/media` });
    }
  }

  /** 
   * Creates a wiki page with this page object's title.
   * 
   * This endpoint is designed to be used with the OAuth extension authorization process. Callers using cookie-based authentication instead must add a CSRF `token` to the request body. To get a CSRF token, see the [Action API](https://www.mediawiki.org/wiki/API:Tokens).
   */
  async create(options: {
    /** Page content in the format specified by the `content_model` property */
    source: string;

    /** Reason for creating the page. To allow the comment to be filled in by the server, use `"comment": null`. */
    comment: string | null;

    /** Type of content on the page. Defaults to `wikitext`. See [the content handlers reference](https://www.mediawiki.org/wiki/Content_handlers) for content models supported by MediaWiki and extensions. */
    content_model?: string;

    /** CSRF token required when using cookie-based authentication. Omit this property when authorizing using OAuth. */
    token?: string;
  }): Promise<PageWithSource> {
    if (this.wiki.polyfilled) {
      return this.wiki.request({
        method: "POST",
        params: {
          action: "edit",
          title: this.title,
          text: options.source,
          contentmodel: options.content_model,
          token: options.token,
        },
        headers: this.wiki.token
          ? { "Authorization": `Bearer ${this.wiki.token}` }
          : undefined,
      });
    } else {
      return this.wiki.request({
        method: "POST",
        path: "page",
        headers: {
          "Content-Type": "application/json",
          ...(typeof this.wiki.token !== "undefined" &&
            { "Authorization": `Bearer ${this.wiki.token}` }),
        },
        body: JSON.stringify({ title: this.title, ...options }),
      });
    }
  }

  /**
   * Updates or creates a wiki page. This endpoint is designed to be used with the OAuth extension authorization process. Callers using cookie-based authentication instead must add a CSRF `token` to the request body. To get a CSRF token, see the Action API.
   * 
   * To update a page, you need the page's latest revision ID and the page source. First call the get page source endpoint, and then use the `source` and `latest.id` to update the page. If `latest.id` doesn't match the page's latest revision, the API resolves conflicts automatically when possible. In the event of an edit conflict, the API returns a 409 error.
   * 
   * To create a page, omit `latest.id` from the request.
   */
  async update(options: {
    /** Page content in the format specified by the `content_model` property */
    source: string;

    /** Summary of the edit. To allow the comment to be filled in by the server, use `"comment": null`. */
    comment: string | null;

    /** Object containing the identifier for the revision used as the base for the new `source`, required for updating an existing page. To create a page, omit this property. */
    latest?: {
      id: number;
    };

    /** Type of content on the page. Defaults to `wikitext` for new pages or to the existing page's content model. See [the content handlers reference](https://www.mediawiki.org/wiki/Content_handlers) for content models supported by MediaWiki and extensions. */
    content_model?: string;

    /** CSRF token required when using cookie-based authentication. Omit this property when authorizing using OAuth. */
    token?: string;
  }): Promise<PageWithSource> {
    if (this.wiki.polyfilled) {
      return this.wiki.request({
        method: "POST",
        params: {
          action: "edit",
          title: this.title,
          text: options.source,
          summary: options.comment ?? undefined,
          baserevid: options.latest?.id,
          contentmodel: options.content_model,
          token: options.token,
        },
        headers: this.wiki.token
          ? { "Authorization": `Bearer ${this.wiki.token}` }
          : undefined,
      });
    } else {
      return this.wiki.request({
        method: "PUT",
        path: `page/${this.title}`,
        headers: {
          "Content-Type": "application/json",
          ...(typeof this.wiki.token !== "undefined" &&
            { "Authorization": `Bearer ${this.wiki.token}` }),
        },
        body: JSON.stringify({ title: this.title, ...options }),
      });
    }
  }

  /** The history of this page */
  get history(): History {
    return new History(this.wiki, this.title);
  }
}

/**
 * An object representing a wiki page.
 * 
 * You can access any of its properties through async property accessors, or get the computed object by awaiting the object itself. 
 * You can also call `fetch()` which returns the same thing as awaiting the object, but may make more syntactic sense if the page is already a standalone variable.
 * 
 * ```typescript
 * console.log(await wiki.page('Jupiter').title)
 *
 * // OR
 *
 * let data = await wiki.page('Jupiter')
 * console.log(data.title)
 * 
 * // OR
 * 
 * let data = await page.fetch()
 * console.log(data.title)
 * ```
 */
export class AsyncPage extends PageBase implements PromiseLike<ResolvedPage> {
  constructor(protected wiki: Wiki, public title: string) {
    super();
  }

  get id() {
    return this._fetch().then((page) => page.id);
  }

  get key() {
    return this._fetch().then((page) => page.key);
  }

  get latest() {
    return this._fetch().then((page) => page.latest);
  }

  get content_model() {
    return this._fetch().then((page) => page.content_model);
  }

  get license() {
    return this._fetch().then((page) => page.license);
  }

  get source() {
    return this._fetch().then((page) => page.source);
  }

  get html() {
    if (this.wiki.polyfilled) {
      return this.wiki.request({
        params: {
          action: "parse",
          page: this.title,
          prop: "text",
        },
      })
        .then(ParseText.check)
        .then(({ parse }) => parse.text);
    } else {
      return fetch(new URL(`page/${this.title}/html`, this.wiki.apiUrl))
        .then((response) => response.text());
    }
  }

  /** Returns the data without wrapping it in a ResolvedPage. */
  private async _fetch(): Promise<PageWithSource> {
    if (this.wiki.polyfilled) {
      const { query } = await this.wiki.request({
        params: {
          action: "query",
          titles: this.title,
          prop: ["revisions", "info"],
          rvprop: ["ids", "timestamp", "content"],
          rvlimit: 1,
          meta: "siteinfo",
          siprop: "rightsinfo",
        },
      }).then(QueryPages.check);

      const page = query.pages[0];
      const revision = page.revisions[0];

      return {
        id: page.pageid,
        key: page.title.replaceAll(" ", "_"),
        title: page.title,
        latest: {
          id: revision.revid,
          timestamp: revision.timestamp,
        },
        content_model: page.contentmodel,
        // This is the license for the entire wiki; not sure if those are the same
        license: {
          url: query.rightsinfo.url,
          title: query.rightsinfo.text,
        },
        source: revision.content,
      };
    } else {
      return this.wiki.request({ path: `page/${this.title}` })
        .then(PageWithSource.check);
    }
  }

  async fetch(): Promise<ResolvedPage> {
    return new ResolvedPage(
      this.wiki,
      await this._fetch(),
    );
  }

  // Promise methods

  then<TResult1 = ResolvedPage, TResult2 = never>(
    onfulfilled?:
      | ((
        value: ResolvedPage,
      ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.fetch().then(onfulfilled, onrejected);
  }
}

/**
 * An object representing a wiki page, with its values resolved. 
 * The properties which aren't directly on the page object are still asynchronous.
 */
export class ResolvedPage extends PageBase implements PageWithSource {
  id: number;
  key: string;
  title: string;
  latest: {
    id: number;
    timestamp: string;
  };
  content_model: string;
  license: {
    url: string;
    title: string;
  };
  source: string;

  constructor(protected wiki: Wiki, data: PageWithSource) {
    super();

    this.id = data.id;
    this.key = data.key;
    this.title = data.title;
    this.latest = data.latest;
    this.content_model = data.content_model;
    this.license = data.license;
    this.source = data.source;
  }

  toJSON() {
    return {
      id: this.id,
      key: this.key,
      title: this.title,
      latest: this.latest,
      content_model: this.content_model,
      licence: this.license,
      source: this.source,
    };
  }
}
