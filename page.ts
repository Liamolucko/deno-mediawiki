import type { ParseResponse, QueryResponse } from "./actions-api-types.d.ts";
import { History } from "./history.ts";
import type {
  PageLanguage,
  PageWithHtml,
  PageWithSource,
  WikiFile,
} from "./rest-api-types.d.ts";
import Wiki from "./wiki.ts";

/** An object representing a wiki page. */
abstract class PageBase {
  protected abstract wiki: Wiki;
  abstract title: string;

  // Data polyfills

  private get languagesPolyfill(): Promise<PageLanguage[]> {
    return this.wiki.actionsRequest({
      action: "parse",
      prop: "langlinks",
    }).then(({ parse }: ParseResponse) =>
      parse.langlinks.map(({ lang, autonym, title }) => ({
        code: lang,
        name: autonym,
        key: title.replace(" ", "_"),
        title,
      }))
    );
  }

  private get filesPolyfill() {
    return this.wiki.actionsRequest({
      action: "query",
      titles: this.title,
      prop: "images",
    }).then(async ({ query }: QueryResponse) => ({
      files: await Promise.all(
        query.pages[0].images.map((image) =>
          this.wiki.filePolyfill(image.title, false)
        ),
      ),
    }));
  }

  // Data

  get languages(): Promise<PageLanguage[]> {
    return this.wiki.init().then(() =>
      this.wiki.polyfilled
        ? this.languagesPolyfill
        : this.wiki.request(`page/${this.title}/links/language`)
    );
  }

  get files(): Promise<{ files: WikiFile[] }> {
    return this.wiki.init().then(() =>
      this.wiki.polyfilled
        ? this.filesPolyfill
        : this.wiki.request(`page/${this.title}/links/media`)
    );
  }

  // Function polyfills

  private createPolyfill(options: {
    /** Page content in the format specified by the `content_model` property */
    source: string;

    /** Reason for creating the page. To allow the comment to be filled in by the server, use `"comment": null`. */
    comment: string | null;

    /** Type of content on the page. Defaults to `wikitext`. See [the content handlers reference](https://www.mediawiki.org/wiki/Content_handlers) for content models supported by MediaWiki and extensions. */
    content_model?: string;

    /** CSRF token required when using cookie-based authentication. Omit this property when authorizing using OAuth. */
    token?: string;
  }) {
    return this.wiki.actionsRequest({
      action: "edit",
      title: this.title,
      text: options.source,
      contentmodel: options.content_model,
      token: options.token,
    }, {
      method: "POST",
      headers: typeof this.wiki.token !== "undefined"
        ? { "Authorization": `Bearer ${this.wiki.token}` }
        : undefined,
    });
  }

  private updatePolyfill(options: {
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
  }) {
    return this.wiki.actionsRequest({
      action: "edit",
      title: this.title,
      text: options.source,
      summary: options.comment ?? undefined,
      baserevid: options.latest?.id,
      contentmodel: options.content_model,
      token: options.token,
    }, {
      method: "POST",
      headers: typeof this.wiki.token !== "undefined"
        ? { "Authorization": `Bearer ${this.wiki.token}` }
        : undefined,
    });
  }

  // Functions

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
    await this.wiki.init();
    return this.wiki.polyfilled
      ? this.createPolyfill(options)
      : this.wiki.request("page", undefined, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(typeof this.wiki.token !== "undefined" &&
            { "Authorization": `Bearer ${this.wiki.token}` }),
        },
        body: JSON.stringify({ title: this.title, ...options }),
      });
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
    await this.wiki.init();
    return this.wiki.polyfilled
      ? this.updatePolyfill(options)
      : this.wiki.request(`page/${this.title}`, undefined, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(typeof this.wiki.token !== "undefined" &&
            { "Authorization": `Bearer ${this.wiki.token}` }),
        },
        body: JSON.stringify({ title: this.title, ...options }),
      });
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

  // Accessor polyfills

  private get idPolyfill() {
    return this.wiki.actionsRequest({
      action: "parse",
      prop: "",
    }).then(({ parse }: ParseResponse) => parse.pageid);
  }

  private get latestPolyfill() {
    return this.wiki.actionsRequest({
      action: "query",
      titles: this.title,
      prop: "revisions",
      rvprop: ["ids", "timestamp"],
      rvlimit: 1,
    }).then(({ query }: QueryResponse) => {
      const revision = query.pages[0].revisions[0];

      return {
        id: revision.revid,
        timestamp: revision.timestamp,
      };
    });
  }

  private get contentModelPolyfill() {
    return this.wiki.actionsRequest({
      action: "query",
      titles: this.title,
      prop: "info",
    }).then(({ query }: QueryResponse) => query.pages[0].contentmodel);
  }

  private get licensePolyfill() {
    return this.wiki.actionsRequest({
      action: "query",
      meta: "siteinfo",
      siprop: "rightsinfo",
    }).then(({ query }: QueryResponse) => ({
      url: query.rightsinfo.url,
      title: query.rightsinfo.text,
    }));
  }

  private get sourcePolyfill() {
    return this.wiki.actionsRequest({
      action: "parse",
      page: this.title,
      prop: "wikitext",
    }).then(({ parse }: ParseResponse) => parse.wikitext);
  }

  private get htmlPolyfill() {
    return this.wiki.actionsRequest({
      action: "parse",
      page: this.title,
      prop: "text",
    }).then(({ parse }: ParseResponse) => parse.text);
  }

  // Data accessors

  get id() {
    return this.wiki.init().then(() =>
      this.wiki.polyfilled
        ? this.idPolyfill
        : this.wiki.request(`page/${this.title}`)
          .then((response: PageWithSource) => response.id)
    );
  }

  get key() {
    return this.wiki.init().then(() =>
      this.wiki.polyfilled
        ? Promise.resolve(this.title.replace(" ", "_"))
        : this.wiki.request(`page/${this.title}`)
          .then((response: PageWithSource) => response.key)
    );
  }

  get latest() {
    return this.wiki.init().then(() =>
      this.wiki.polyfilled
        ? this.latestPolyfill
        : this.wiki.request(`page/${this.title}`)
          .then((response: PageWithSource) => response.latest)
    );
  }

  get content_model() {
    return this.wiki.init().then(() =>
      this.wiki.polyfilled
        ? this.contentModelPolyfill
        : this.wiki.request(`page/${this.title}`)
          .then((response: PageWithSource) => response.content_model)
    );
  }

  get license() {
    return this.wiki.init().then(() =>
      this.wiki.polyfilled
        ? this.licensePolyfill
        : this.wiki.request(`page/${this.title}`)
          .then((response: PageWithSource) => response.license)
    );
  }

  get source() {
    return this.wiki.init().then(() =>
      this.wiki.polyfilled
        ? this.sourcePolyfill
        : this.wiki.request(`page/${this.title}`)
          .then((response: PageWithSource) => response.source)
    );
  }

  get html() {
    return this.wiki.init().then(() =>
      this.wiki.polyfilled
        ? this.htmlPolyfill
        : fetch(`${this.wiki.apiUrl}/page/${this.title}/html`)
          .then((response) => response.text())
    );
  }

  // Fetch all data

  private async fetchPolyfill(): Promise<PageWithSource & PageWithHtml> {
    return Promise.all(
      [
        this.wiki.actionsRequest({
          action: "query",
          titles: this.title,
          prop: ["revisions", "info"],
          rvprop: ["ids", "timestamp"],
          rvlimit: 1,
          meta: "siteinfo",
          siprop: "rightsinfo",
        }),
        this.wiki.actionsRequest({
          action: "parse",
          page: this.title,
          prop: ["text", "wikitext"],
        }),
      ],
    ).then(
      async (
        [{ query }, { parse }]: [QueryResponse, ParseResponse],
      ) => {
        const page = query.pages[0];
        const revision = page.revisions[0];

        return {
          id: parse.pageid,
          key: await this.key,
          title: parse.title,
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
          source: parse.wikitext,
          html: parse.text,
        };
      },
    );
  }

  async fetch(): Promise<ResolvedPage> {
    return new ResolvedPage(
      this.wiki,
      this.wiki.polyfilled ? await this.fetchPolyfill() : {
        ...await this.wiki.request(`page/${this.title}`),
        html: await this.html,
      },
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
export class ResolvedPage extends PageBase
  implements PageWithSource, PageWithHtml {
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
  html: string;

  constructor(protected wiki: Wiki, data: PageWithSource & PageWithHtml) {
    super();

    this.id = data.id;
    this.key = data.key;
    this.title = data.title;
    this.latest = data.latest;
    this.content_model = data.content_model;
    this.license = data.license;
    this.source = data.source;
    this.html = data.html;
  }
}
