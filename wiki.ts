import * as path from "https://deno.land/std/path/mod.ts";
import { ActionsError, LegacyActionsError } from "./actions-api-types.ts";
import {
  ApiError,
  CompleteResult,
  FileWithThumbnail,
  PageWithHtml,
  PageWithSource,
  SearchResult,
  Revision,
  Diff,
} from "./rest-api-types.ts";

function isRestError(response: any): response is ApiError {
  return typeof response.httpCode !== "undefined";
}

function handleRestError<T extends object>(response: ApiError | T): T {
  if (!isRestError(response)) return response;

  throw Error(
    response.messageTranslations?.["en"] ?? response.message ??
      response.httpCode.toString(),
  );
}

function isActionsError(
  response: any,
): response is LegacyActionsError | ActionsError {
  return typeof response.error !== "undefined" ||
    typeof response.errors !== "undefined";
}

function isLegacyError(
  error: LegacyActionsError | ActionsError,
): error is LegacyActionsError {
  return typeof (error as LegacyActionsError).error !== "undefined";
}

function handleActionsError<T extends object>(
  response: (LegacyActionsError | ActionsError) | T,
): T {
  if (!isActionsError(response)) return response;

  throw Error(
    isLegacyError(response) ? response.error.info : response.errors[0].text,
  );
}

/**
 * An object representing a wiki page.
 * 
 * You can access any of its properties through async property accessors or by calling fetch() which returns an object with all of its computed properties.
 * 
 * ```typescript
 * console.log(await page.title)
 *
 * // OR
 *
 * let data = await page.fetch()
 * console.log(data.title)
 * ```
 */
class Page {
  constructor(private wiki: Wiki, public title: string) {}

  get id() {
    return this.wiki._restRequest(`v1/page/${this.title}`)
      .then((response: PageWithSource) => response.id);
  }

  get key() {
    return this.wiki._restRequest(`v1/page/${this.title}`)
      .then((response: PageWithSource) => response.key);
  }

  get latest() {
    return this.wiki._restRequest(`v1/page/${this.title}`)
      .then((response: PageWithSource) => response.latest);
  }

  get content_model() {
    return this.wiki._restRequest(`v1/page/${this.title}`)
      .then((response: PageWithSource) => response.content_model);
  }

  get license() {
    return this.wiki._restRequest(`v1/page/${this.title}`)
      .then((response: PageWithSource) => response.license);
  }

  get html() {
    return fetch(`${this.wiki.apiUrl}/v1/page/${this.title}/html`)
      .then((response) => response.text());
  }

  get source() {
    return this.wiki._restRequest(`v1/page/${this.title}`)
      .then((response: PageWithSource) => response.source);
  }

  async fetch(): Promise<PageWithSource & PageWithHtml> {
    return {
      ...await this.wiki._restRequest(`v1/page/${this.title}`),
      html: await this.html,
    };
  }

  /** 
   * Creates a wiki page with this page object's title.
   * 
   * This endpoint is designed to be used with the OAuth extension authorization process. Callers using cookie-based authentication instead must add a CSRF `token` to the request body. To get a CSRF token, see the [Action API](https://www.mediawiki.org/wiki/API:Tokens).
   */
  create(options: {
    /** Page content in the format specified by the `content_model` property */
    source: string;

    /** Reason for creating the page. To allow the comment to be filled in by the server, use `"comment": null`. */
    comment: string | null;

    /** Type of content on the page. Defaults to `wikitext`. See [the content handlers reference](https://www.mediawiki.org/wiki/Content_handlers) for content models supported by MediaWiki and extensions. */
    content_model?: string;

    /** CSRF token required when using cookie-based authentication. Omit this property when authorizing using OAuth. */
    token?: string;
  }): Promise<PageWithSource> {
    return this.wiki._restRequest("v1/page", undefined, {
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
  update(options: {
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
    return this.wiki._restRequest(`v1/page/${this.title}`, undefined, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(typeof this.wiki.token !== "undefined" &&
          { "Authorization": `Bearer ${this.wiki.token}` }),
      },
      body: JSON.stringify({ title: this.title, ...options }),
    });
  }

  /** Returns information about the latest revisions to a wiki page, in segments of 20 revisions, starting with the latest revision. The response includes API routes for the next oldest, next newest, and latest revision segments, letting you scroll through page history. */
  history(
    options?: {
      /** Accepts a revision ID. Returns the next 20 revisions older than the given revision ID. */
      older_than?: string;

      /** Accepts a revision ID. Returns the next 20 revisions newer than the given revision ID. */
      newer_than?: string;

      /** Filter that returns only revisions with certain tags */
      filter?: "reverted" | "anonymous" | "bot" | "minor";
    },
  ): Promise<{ revisions: Revision[] }> {
    return this.wiki._restRequest(
      `v1/page/${this.title}/history`,
      options as Required<typeof options>, // If they're undefined, they won't be properties at all
    );
  }

  editCount(
    /** Type of count */
    type: "anonymous" | "bot" | "editors" | "edits" | "minor" | "reverted",
    from: number,
    to: number,
  ) {
    return this.wiki._restRequest(
      `v1/page/${this.title}/history/counts/${type}`,
      { from: from.toString(), to: to.toString() },
    );
  }
}

/**
 * A wrapper object for a wiki at a given url.
 */
export class Wiki {
  url: string;
  apiUrl: string;
  polyfilled: boolean;

  private initialized = false;

  /**
   * Creates a wiki object from it's API url
   * @param url The path to the wiki's Mediawiki directory or the API directly, 
   * e.g. https://en.wikipedia.org/w or https://en.wikipedia.org/w/rest.php
   * @param token OAuth token to use for authentication
   */
  constructor(url: string, public token?: string) {
    // Find path of mediawiki installation and user's chosen API, if any
    const [mediawikiPath, api] = url.split(/\/?(?=(?:(?:rest|api)\.php)?\/?$)/);

    this.url = mediawikiPath;
    this.polyfilled = api === "api.php";
    this.apiUrl = path.join(this.url, this.polyfilled ? "api.php" : "rest.php");
  }

  /**
   * Checks which APIs are available and validates url. Called on first request.
   */
  private async init() {
    if (this.initialized) return;

    if (
      (await fetch(path.join(this.apiUrl, "v1/search?q=test"))).status === 404
    ) {
      // If they've already chosen the Actions API and it's not there, throw
      if (this.polyfilled) throw Error("Invalid API url");

      this.polyfilled = true;
      this.apiUrl = path.join(this.url, "api.php");

      // If neither the REST or Actions API are there, throw
      if (
        (await fetch(path.join(this.apiUrl, "v1/search?q=test"))).status === 404
      ) {
        throw Error("Invalid API url");
      }
    }
  }

  /** 
   * Low-level REST API command. NOT POLYFILLED! 
   * 
   * It's only public so I can access it in Page. 
   */
  _restRequest(
    subPath: string,
    params?: Record<string, string>,
    init?: RequestInit,
  ) {
    return fetch(
      `${path.join(this.apiUrl, subPath)}?${
        new URLSearchParams(params).toString()
      }`,
      init,
    )
      .then((response) => response.json())
      .then(handleRestError);
  }

  /** 
   * Low-level Actions API command.
   * 
   * It's only public so I can access it in Page. 
   */
  _actionsRequest(params?: Record<string, string>) {
    return fetch(`${this.apiUrl}?${new URLSearchParams({
      format: "json",
      formatversion: "2",
      errorformat: "plaintext",
      ...params,
    })}`)
      .then((response) => response.json())
      .then(handleActionsError);
  }

  /**
   * Searches wiki page titles and contents for the provided search terms, and returns matching pages.
   * @param q Search terms
   * @param limit Maximum number of search results to return, between 1 and 100. Default: 50
   */
  async search(
    q: string,
    limit: number | string = 50,
  ): Promise<{ pages: SearchResult[] }> {
    if (!this.initialized) this.init();

    if (limit < 1 || limit > 100) {
      throw Error(
        "Invalid limit requested. Set limit parameter to between 1 and 100.",
      );
    }

    return this._restRequest(
      "v1/search/page",
      { q, limit: limit.toString() },
    );
  }

  /** 
   * Searches wiki page titles, and returns matches between the beginning of a title and the provided search terms. You can use this endpoint for a typeahead search that automatically suggests relevant pages by title.
   * @param q Search terms
   * @param limit Maximum number of search results to return, between 1 and 100. Default: 50
   */
  async complete(
    q: string,
    limit: number | string = 50,
  ): Promise<{ pages: CompleteResult[] }> {
    if (!this.initialized) this.init();

    if (limit < 1 || limit > 100) {
      throw Error(
        "Invalid limit requested. Set limit parameter to between 1 and 100.",
      );
    }

    return this._restRequest(
      "v1/search/title",
      { q, limit: limit.toString() },
    );
  }

  /**
   * Returns a `Page` object with the given key.
   * 
   * You can access any of its properties through async property accessors or by calling fetch() which returns an object with all of its computed properties.
   * 
   * @param title The title of the page.
   * 
   * ```typescript
   * console.log(await page.title)
   *
   * // OR
   *
   * let data = await page.fetch()
   * console.log(data.title)
   * ```
   */
  page(title: string) {
    return new Page(this, title);
  }

  /**
   * Returns information about a file, including links to download the file in thumbnail, preview, and original formats.
   * @param title File title
   */
  file(title: string): Promise<FileWithThumbnail> {
    return this._restRequest(`v1/file/${title}`);
  }

  /** 
   * Returns details for an individual revision.
   * 
   * It can also be chained for the effect of `compare`:
   * ```typescript
   * await wiki.revision(42).compare(43)
   * // Is equivalent to
   * await wiki.compare(42, 43)
   * ```
   */
  revision(
    id: number | string,
  ): Promise<Revision> & { compare: (to: number | string) => Promise<Diff> } {
    return {
      ...this._restRequest(`v1/revision/${id}/bare`),
      compare: (to) => this.compare(id, to),
    };
  }

  /** 
   * Returns data that lets you display a line-by-line comparison of two revisions. (See [an example](https://en.wikipedia.beta.wmflabs.org/w/index.php?diff=388864&oldid=388863&title=Main_Page&type=revision).) Only text-based wiki pages can be compared. 
   * @param from Revision identifier to use as the base for comparison
   * @param to Revision identifier to compare to the base
   */
  compare(from: number | string, to: number | string): Promise<Diff> {
    return this._restRequest(`v1/revision/${from}/compare/${to}`);
  }
}

export default Wiki;
